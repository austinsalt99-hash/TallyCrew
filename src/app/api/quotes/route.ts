import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { paidTotals } from "@/lib/billing";
import { buildQuoteWrite, nextQuoteNumber } from "./quoteFields";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const [{ data, error }, paid] = await Promise.all([
    supabase.from("quotes").select("*").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
    paidTotals(supabase, profile.company_id),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((q) => ({ ...q, amount_paid: paid.byQuote.get(q.id) ?? 0 })));
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const body = await request.json();
  if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const { row, error: bodyErr } = await buildQuoteWrite(supabase, body, profile.company_id, null);
  if (bodyErr) return NextResponse.json({ error: bodyErr }, { status: 400 });

  if (!row.quote_number) {
    const { data: existing } = await supabase.from("quotes").select("quote_number").eq("company_id", profile.company_id);
    row.quote_number = nextQuoteNumber((existing ?? []).map((q) => q.quote_number));
  }

  const { data, error } = await supabase
    .from("quotes")
    .insert({ status: "draft", ...row, company_id: profile.company_id })
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505" ? "That quote number is already used. Pick a different one." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ ...data, amount_paid: 0 });
}
