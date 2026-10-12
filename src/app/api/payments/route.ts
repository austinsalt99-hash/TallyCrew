import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { syncInvoicePaymentStatus } from "@/lib/billing";
import { PAYMENT_METHODS } from "@/app/admin/invoices/_components/invoiceFormat";

async function adminGuard(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return { error: "Unauthorized", status: 401, profile: null };
  if (profile.role !== "admin") return { error: "Forbidden", status: 403, profile: null };
  return { error: null, status: 200, profile };
}

const METHODS: string[] = PAYMENT_METHODS.map((m) => m.value);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/payments?invoiceId=… or ?quoteId=…
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId");
  const quoteId = searchParams.get("quoteId");
  if (!invoiceId && !quoteId) return NextResponse.json({ error: "invoiceId or quoteId required" }, { status: 400 });

  let query = supabase
    .from("payments")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("paid_on")
    .order("created_at");
  query = invoiceId ? query.eq("invoice_id", invoiceId) : query.eq("quote_id", quoteId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const body = await request.json();
  const amount = Math.round((parseFloat(String(body.amount ?? "")) || 0) * 100) / 100;
  if (amount <= 0) return NextResponse.json({ error: "Enter an amount greater than $0." }, { status: 400 });
  const paidOn = typeof body.paid_on === "string" && DATE_RE.test(body.paid_on) ? body.paid_on : null;
  if (!paidOn) return NextResponse.json({ error: "Enter the date it was paid." }, { status: 400 });
  const method = METHODS.includes(body.method) ? body.method : "other";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  let quoteId: string | null = null;
  let invoiceId: string | null = null;

  if (body.quote_id) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, converted_invoice_id")
      .eq("id", body.quote_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    quoteId = quote.id;
    // Already invoiced: the money counts toward that invoice too
    invoiceId = quote.converted_invoice_id ?? null;
  } else if (body.invoice_id) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("id", body.invoice_id)
      .eq("company_id", profile.company_id)
      .maybeSingle();
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    invoiceId = invoice.id;
  } else {
    return NextResponse.json({ error: "quote_id or invoice_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({ company_id: profile.company_id, quote_id: quoteId, invoice_id: invoiceId, amount, paid_on: paidOn, method, note })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (invoiceId) await syncInvoicePaymentStatus(supabase, invoiceId, profile.company_id);
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { error: authErr, status, profile } = await adminGuard(supabase);
  if (authErr || !profile) return NextResponse.json({ error: authErr }, { status });

  const { id } = await request.json();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, invoice_id")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const { error } = await supabase.from("payments").delete().eq("id", id).eq("company_id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (payment.invoice_id) await syncInvoicePaymentStatus(supabase, payment.invoice_id, profile.company_id);
  return NextResponse.json({ ok: true });
}
