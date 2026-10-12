import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { markJobsInvoiced, syncInvoicePaymentStatus } from "@/lib/billing";
import { buildInvoiceWrite } from "../invoiceFields";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pays } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", id)
    .eq("company_id", profile.company_id);
  const amountPaid = Math.round((pays ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;

  return NextResponse.json({ ...data, amount_paid: amountPaid });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: existing } = await supabase
    .from("invoices")
    .select("tax_rate")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const body = await request.json();
  const { row, error: bodyErr } = await buildInvoiceWrite(supabase, body, profile.company_id, existing);
  if (bodyErr) return NextResponse.json({ error: bodyErr }, { status: 400 });
  if (Object.keys(row).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase
    .from("invoices")
    .update(row)
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) {
    const msg = error.code === "23505" ? "That invoice number is already used. Pick a different one." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }

  // A new total (or a status change) can move it between sent / partial / paid
  await syncInvoicePaymentStatus(supabase, id, profile.company_id);
  // Hour logs added while editing mark their jobs invoiced too
  if ("line_items" in row) await markJobsInvoiced(supabase, profile.company_id, row.line_items, null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Payments recorded only on this invoice go with it. Deposits that came from
  // a quote stay on that quote (their invoice_id is cleared by the foreign key).
  await supabase
    .from("payments")
    .delete()
    .eq("invoice_id", id)
    .is("quote_id", null)
    .eq("company_id", profile.company_id);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
