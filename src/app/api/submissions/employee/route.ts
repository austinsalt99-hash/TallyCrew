import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Single full submission for a specific date
  if (date) {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("submitted_at", { ascending: false })
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.[0] ?? null);
  }

  // Date range — returns summary rows for history list / weekly summary
  if (from && to) {
    const { data, error } = await supabase
      .from("submissions")
      .select("id, date, total_billable_hours, total_non_billable_hours, break_minutes, day_start_time, day_end_time, submitted_at")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  return NextResponse.json({ error: "date or from/to required" }, { status: 400 });
}
