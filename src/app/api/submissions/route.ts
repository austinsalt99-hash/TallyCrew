import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("submissions")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("date", { ascending: false })
    .order("submitted_at", { ascending: false });

  if (eventId) {
    // Targeted lookup for a specific linked job — searches full history,
    // not bounded by date like the default list view below.
    query = query.filter("billable_entries", "cs", JSON.stringify([{ linkedEventId: eventId }]));
  } else {
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, entryIndex, linkedEventId, linkedEventTitle } = await request.json();
  if (!id || entryIndex == null) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: sub, error: fetchErr } = await supabase
    .from("submissions")
    .select("billable_entries")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single();

  if (fetchErr || !sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries: object[] = Array.isArray(sub.billable_entries) ? sub.billable_entries : [];
  if (entryIndex >= entries.length) return NextResponse.json({ error: "Invalid entry index" }, { status: 400 });

  const updated = entries.map((e, i) =>
    i === entryIndex ? { ...(e as object), linkedEventId, linkedEventTitle } : e
  );

  const { error } = await supabase
    .from("submissions")
    .update({ billable_entries: updated })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
