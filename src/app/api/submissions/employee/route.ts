import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  const date = searchParams.get("date");

  if (!name || !date) {
    return NextResponse.json({ error: "name and date required" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("submissions")
    .select("*")
    .ilike("employee_name", name)
    .eq("date", date)
    .order("submitted_at", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.[0] ?? null);
}
