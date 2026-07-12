import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("availability_requests")
    .select("id, employee_id, date_start, date_end, status, notes, created_at, profiles!inner(full_name)")
    .eq("company_id", profile.company_id)
    .neq("status", "denied")
    .order("date_start");

  if (from) query = query.gte("date_end", from);
  if (to) query = query.lte("date_start", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    employee_id: row.employee_id,
    employee_name: row.profiles?.full_name ?? null,
    date_start: row.date_start,
    date_end: row.date_end,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
  }));

  return NextResponse.json(mapped);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date_start, date_end, notes } = await request.json();
  if (!date_start || !date_end) {
    return NextResponse.json({ error: "date_start and date_end required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("availability_requests")
    .insert({
      company_id: profile.company_id,
      employee_id: user.id,
      date_start,
      date_end,
      notes: notes ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const { error } = await supabase
    .from("availability_requests")
    .update({ status })
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
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("availability_requests")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
