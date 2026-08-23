import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
