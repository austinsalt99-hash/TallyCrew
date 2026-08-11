import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("companies")
    .select("name, banner_url, invoice_logo_url, timezone, pay_period_type, pay_period_anchor, morning_digest_time")
    .eq("id", profile.company_id)
    .single();

  return NextResponse.json(data ?? {});
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.banner_url !== undefined) updates.banner_url = body.banner_url;
  if (body.timezone !== undefined) updates.timezone = body.timezone;
  if (body.pay_period_type !== undefined) updates.pay_period_type = body.pay_period_type;
  if (body.pay_period_anchor !== undefined) updates.pay_period_anchor = body.pay_period_anchor;
  if (body.morning_digest_time !== undefined) updates.morning_digest_time = body.morning_digest_time;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
