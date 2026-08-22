import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

// Only these columns may be set from the request body — prevents a client
// from writing to columns the form doesn't expose (e.g. company_id).
const EVENT_FIELDS = [
  "title",
  "client",
  "location",
  "description",
  "date",
  "end_date",
  "start_time",
  "end_time",
  "assigned_to",
  "is_verified",
  "ongoing_job_id",
  "status",
  "quoted_price",
  "po_number",
  "internal_notes",
  "equipment_needed",
  "attachments",
] as const;

// Admin-only columns — stripped from GET responses for non-admin callers.
// RLS (job_events_read) grants full-row SELECT to every company member, so
// this filter is the only thing keeping pricing/internal notes from workers.
const ADMIN_ONLY_FIELDS = ["quoted_price", "po_number", "internal_notes"] as const;

function pickEventFields(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of EVENT_FIELDS) {
    if (field in body) picked[field] = body[field];
  }
  return picked;
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
  if (profile.role !== "admin") {
    const stripped = (data ?? []).map((row: Record<string, unknown>) => {
      const copy = { ...row };
      for (const field of ADMIN_ONLY_FIELDS) delete copy[field];
      return copy;
    });
    return NextResponse.json(stripped);
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const body = await request.json();
  const cleanBody = pickEventFields(body);
  cleanBody.start_time = cleanBody.start_time || null;
  cleanBody.end_time = cleanBody.end_time || null;
  cleanBody.end_date = cleanBody.end_date || null;
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

  const { id, ...body } = await request.json();
  const updates = pickEventFields(body);
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
