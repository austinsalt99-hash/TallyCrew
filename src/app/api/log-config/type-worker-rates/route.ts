import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

async function assertOwnsType(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  companyId: string,
  typeId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("log_entry_types")
    .select("id")
    .eq("id", typeId)
    .eq("company_id", companyId)
    .single();
  return !!data;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const typeId = searchParams.get("type_id");
  if (!typeId) return NextResponse.json({ error: "type_id required" }, { status: 400 });
  if (!(await assertOwnsType(supabase, profile.company_id, typeId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("log_entry_type_worker_rates")
    .select("id, type_id, worker_id, rate_amount")
    .eq("type_id", typeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type_id, worker_id, rate_amount } = await request.json();
  if (!type_id || !worker_id) return NextResponse.json({ error: "type_id and worker_id required" }, { status: 400 });
  if (!(await assertOwnsType(supabase, profile.company_id, type_id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Empty/blank rate clears the override, falling back to the flat type
  // rate or the worker's payroll wage.
  if (rate_amount == null || rate_amount === "") {
    const { error } = await supabase
      .from("log_entry_type_worker_rates")
      .delete()
      .eq("type_id", type_id)
      .eq("worker_id", worker_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await supabase
    .from("log_entry_type_worker_rates")
    .upsert({ type_id, worker_id, rate_amount: Number(rate_amount) }, { onConflict: "type_id,worker_id" })
    .select("id, type_id, worker_id, rate_amount")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
