import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, hourly_wage")
    .eq("company_id", profile.company_id)
    .order("created_at");

  if (error) {
    // hourly_wage column may not exist yet (migration pending) — fall back without it
    const { data: fallback, error: fallbackError } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at");
    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    return NextResponse.json((fallback ?? []).map((p) => ({ ...p, hourly_wage: null })));
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { workerId, hourly_wage } = await request.json();
  if (!workerId) return NextResponse.json({ error: "workerId required" }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .update({ hourly_wage: hourly_wage != null ? Number(hourly_wage) : null })
    .eq("id", workerId)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
