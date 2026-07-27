import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const unverifiedOnly = searchParams.get("unverified") === "1";
  const ongoingJobId = searchParams.get("ongoingJobId");

  let query = supabase
    .from("job_events")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("date")
    .order("start_time");

  if (ongoingJobId) {
    // Every calendar entry ever scheduled under this ongoing job, regardless
    // of date range — used to bulk-link them all into one invoice.
    query = query.eq("ongoing_job_id", ongoingJobId);
  } else if (unverifiedOnly) {
    // Drafts (e.g. from the Siri shortcut) can land on any date, so this
    // ignores the from/to range entirely — the admin needs to see all of them.
    query = query.eq("is_verified", false);
  } else if (from && to) {
    // Fetch events that overlap the requested range, including multi-day events
    query = query.lte("date", to).or(`end_date.gte.${from},date.gte.${from}`);
  } else if (from) {
    query = query.gte("date", from);
  } else if (to) {
    query = query.lte("date", to);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const body = await request.json();
  const cleanBody = { ...body, start_time: body.start_time || null, end_time: body.end_time || null, end_date: body.end_date || null };
  const { data, error } = await supabase
    .from("job_events")
    .insert({ ...cleanBody, company_id: profile.company_id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { id, ...updates } = await request.json();
  // Only normalize fields the caller actually sent — defaulting an *omitted*
  // field to null (rather than leaving it untouched) silently wipes it on
  // every partial update (e.g. drag-to-reschedule only sends date/time,
  // "quick verify" only sends is_verified — neither should blank end_date).
  const cleanUpdates: Record<string, unknown> = { ...updates };
  if ("start_time" in updates) cleanUpdates.start_time = updates.start_time || null;
  if ("end_time" in updates) cleanUpdates.end_time = updates.end_time || null;
  if ("end_date" in updates) cleanUpdates.end_date = updates.end_date || null;
  const { data, error } = await supabase
    .from("job_events")
    .update(cleanUpdates)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { id } = await request.json();
  const { error } = await supabase
    .from("job_events")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
