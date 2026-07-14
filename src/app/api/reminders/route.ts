import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (profile.role === "admin") {
    const { data, error } = await supabase
      .from("reminders")
      .select("id, title, body, target_type, target_user_ids, send_time, days_of_week, active, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  // Workers: only active reminders targeted at them
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, body, send_time, days_of_week, created_at")
    .eq("company_id", profile.company_id)
    .eq("active", true)
    .order("send_time");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // RLS already filters to 'all' or user's id in target_user_ids
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, body: text, target_type, target_user_ids, send_time, days_of_week } = body as {
    title: string;
    body?: string;
    target_type: "all" | "specific";
    target_user_ids?: string[];
    send_time: string;
    days_of_week: number[];
  };

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!send_time) return NextResponse.json({ error: "send_time required" }, { status: 400 });
  if (!days_of_week?.length) return NextResponse.json({ error: "At least one day required" }, { status: 400 });
  if (target_type === "specific" && !target_user_ids?.length)
    return NextResponse.json({ error: "At least one employee required" }, { status: 400 });

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      company_id: profile.company_id,
      created_by: user.id,
      title: title.trim(),
      body: text?.trim() || null,
      target_type,
      target_user_ids: target_type === "specific" ? target_user_ids : null,
      send_time,
      days_of_week,
    })
    .select("id, title, body, target_type, target_user_ids, send_time, days_of_week, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
