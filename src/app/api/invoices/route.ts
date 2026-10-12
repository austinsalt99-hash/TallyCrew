import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { markJobsInvoiced, ownsRow, paidTotals, syncInvoicePaymentStatus } from "@/lib/billing";
import { buildInvoiceWrite } from "./invoiceFields";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data, error }, paid] = await Promise.all([
    supabase.from("invoices").select("*").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
    paidTotals(supabase, profile.company_id),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((inv) => ({ ...inv, amount_paid: paid.byInvoice.get(inv.id) ?? 0 })));
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { row, error: bodyErr } = await buildInvoiceWrite(supabase, body, profile.company_id, null);
  if (bodyErr) return NextResponse.json({ error: bodyErr }, { status: 400 });

  const sourceQuoteId = (await ownsRow(supabase, "quotes", body.source_quote_id, profile.company_id))
    ? (body.source_quote_id as string)
    : null;

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      line_items: [],
      total: 0,
      status: "draft",
      column_config: [],
      ...row,
      source_quote_id: sourceQuoteId,
      company_id: profile.company_id,
    })
    .select()
    .single();
  if (error) {
    const msg = error.code === "23505" ? "That invoice number is already used. Pick a different one." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }

  // Made from a quote: link them, and carry the quote's deposits onto the invoice.
  if (sourceQuoteId) {
    await supabase
      .from("quotes")
      .update({ converted_invoice_id: data.id })
      .eq("id", sourceQuoteId)
      .eq("company_id", profile.company_id);
    await supabase
      .from("payments")
      .update({ invoice_id: data.id })
      .eq("quote_id", sourceQuoteId)
      .is("invoice_id", null)
      .eq("company_id", profile.company_id);
    await syncInvoicePaymentStatus(supabase, data.id, profile.company_id);
  }

  await markJobsInvoiced(supabase, profile.company_id, data.line_items, sourceQuoteId);
  return NextResponse.json(data);
}
