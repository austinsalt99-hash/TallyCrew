import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { buildQuoteWrite } from "../quoteFields";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const { data: pays } = await supabase
    .from("payments")
    .select("amount")
    .eq("quote_id", id)
    .eq("company_id", profile.company_id);
  const amountPaid = Math.round((pays ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;

  return NextResponse.json({ ...data, amount_paid: amountPaid });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { data: existing } = await supabase
    .from("quotes")
    .select("tax_rate, sent_at, status")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const body = await request.json();
  const { row, error: bodyErr } = await buildQuoteWrite(supabase, body, profile.company_id, existing);
  if (bodyErr) return NextResponse.json({ error: bodyErr }, { status: 400 });
  if (Object.keys(row).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("quotes")
    .update(row)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505" ? "That quote number is already used. Pick a different one." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  // Deposits that never moved onto an invoice go with the quote. Ones that did
  // stay on that invoice (their quote_id is cleared by the foreign key).
  await supabase
    .from("payments")
    .delete()
    .eq("quote_id", id)
    .is("invoice_id", null)
    .eq("company_id", profile.company_id);

  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
