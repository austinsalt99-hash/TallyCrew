// Server-side helpers shared by the quote, invoice, payment and client API routes.
import type { createSupabaseServer } from "@/lib/supabase-server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServer>>;

// True when `id` is a row of `table` belonging to the caller's company. Used
// before storing a reference (client_id, converted_job_id, …) from a request
// body, since a foreign key alone would accept another company's row.
export async function ownsRow(
  supabase: Supabase,
  table: "clients" | "job_events" | "quotes" | "invoices",
  id: unknown,
  companyId: string,
): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const { data } = await supabase.from(table).select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return !!data;
}

// A client_id from a request body, or null if it's missing or not this company's.
export async function ownedClientId(supabase: Supabase, clientId: unknown, companyId: string): Promise<string | null> {
  return (await ownsRow(supabase, "clients", clientId, companyId)) ? (clientId as string) : null;
}

// The contact to link: the given client_id if it's this company's, otherwise
// a saved contact with exactly this name (any capitalisation), otherwise null.
// Covers names that were filled in automatically rather than picked.
export async function resolveClientId(
  supabase: Supabase, clientId: unknown, name: unknown, companyId: string,
): Promise<string | null> {
  const owned = await ownedClientId(supabase, clientId, companyId);
  if (owned) return owned;
  if (typeof name !== "string" || !name.trim()) return null;
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", name.trim().replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export function pickFields(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const f of fields) if (f in body) picked[f] = body[f];
  return picked;
}

// Amount paid so far on every invoice and quote in the company.
export async function paidTotals(supabase: Supabase, companyId: string) {
  const { data } = await supabase.from("payments").select("invoice_id, quote_id, amount").eq("company_id", companyId);
  const byInvoice = new Map<string, number>();
  const byQuote = new Map<string, number>();
  for (const p of data ?? []) {
    const amt = Number(p.amount) || 0;
    if (p.invoice_id) byInvoice.set(p.invoice_id, (byInvoice.get(p.invoice_id) ?? 0) + amt);
    if (p.quote_id) byQuote.set(p.quote_id, (byQuote.get(p.quote_id) ?? 0) + amt);
  }
  const round = (m: Map<string, number>) => { for (const [k, v] of m) m.set(k, Math.round(v * 100) / 100); return m; };
  return { byInvoice: round(byInvoice), byQuote: round(byQuote) };
}

// Sets calendar jobs billed on an invoice to "Invoiced": every job whose hour
// logs are on it, plus the job its quote was scheduled as. Cancelled jobs are left alone.
export async function markJobsInvoiced(
  supabase: Supabase, companyId: string, lineItems: unknown, sourceQuoteId: string | null,
) {
  const ids = new Set<string>();
  if (Array.isArray(lineItems)) {
    for (const li of lineItems as { sourceJobId?: unknown }[]) {
      if (typeof li?.sourceJobId === "string" && li.sourceJobId) ids.add(li.sourceJobId);
    }
  }
  if (sourceQuoteId) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("converted_job_id")
      .eq("id", sourceQuoteId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (quote?.converted_job_id) ids.add(quote.converted_job_id);
  }
  if (ids.size === 0) return;
  await supabase
    .from("job_events")
    .update({ status: "invoiced" })
    .eq("company_id", companyId)
    .in("id", [...ids])
    .neq("status", "cancelled");
}

// Keeps an invoice's status in step with its recorded payments:
// nothing paid → draft/sent as the admin set it, some paid → "partial",
// all paid → "paid" (paid_at = the day the last payment came in).
export async function syncInvoicePaymentStatus(supabase: Supabase, invoiceId: string, companyId: string) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, total, status")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!inv) return;

  const { data: pays } = await supabase
    .from("payments")
    .select("amount, paid_on")
    .eq("invoice_id", invoiceId)
    .eq("company_id", companyId);

  const paid = (pays ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total = Number(inv.total) || 0;
  const lastPaidOn = (pays ?? []).map((p) => p.paid_on as string).sort().at(-1);

  let status = inv.status as string;
  let paidAt: string | null = null;
  if (paid > 0 && paid + 0.005 >= total) {
    status = "paid";
    // Noon UTC keeps the stored day the same in any North American timezone
    paidAt = `${lastPaidOn}T12:00:00Z`;
  } else if (paid > 0) {
    status = "partial";
  } else if (status === "paid" || status === "partial") {
    status = "sent";
  }

  await supabase.from("invoices").update({ status, paid_at: paidAt }).eq("id", invoiceId).eq("company_id", companyId);
}
