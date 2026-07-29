import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const {
    active, title, body: text, target_type, target_user_ids, send_time, days_of_week, one_off_date,
  } = body as {
    active?: boolean;
    title?: string;
    body?: string | null;
    target_type?: "all" | "specific";
    target_user_ids?: string[] | null;
    send_time?: string;
    days_of_week?: number[] | null;
    one_off_date?: string | null;
  };

  const update: Record<string, unknown> = {};
  if (active !== undefined) update.active = active;
  if (title !== undefined) {
    if (!title.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
    update.title = title.trim();
  }
  if (text !== undefined) update.body = text?.trim() || null;
  if (target_type !== undefined) update.target_type = target_type;
  if (target_user_ids !== undefined) update.target_user_ids = target_type === "specific" ? target_user_ids : null;
  if (send_time !== undefined) update.send_time = send_time;
  if (days_of_week !== undefined || one_off_date !== undefined) {
    if (!one_off_date && !days_of_week?.length)
      return NextResponse.json({ error: "At least one day (or a one-time date) required" }, { status: 400 });
    update.days_of_week = one_off_date ? null : days_of_week;
    update.one_off_date = one_off_date || null;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("reminders")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select("id, title, body, target_type, target_user_ids, send_time, days_of_week, one_off_date, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
