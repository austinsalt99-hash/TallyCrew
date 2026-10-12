import type { createSupabaseServer } from "@/lib/supabase-server";
import { pickFields, resolveClientId } from "@/lib/billing";
import { computeTotals } from "@/app/admin/invoices/_components/invoiceFormat";

type Supabase = Awaited<ReturnType<typeof createSupabaseServer>>;

// Only these columns may be set from a request body. "partial" / "paid",
// paid_at and the totals are set by the server from line items and payments.
const INVOICE_FIELDS = [
  "invoice_number", "client_name", "client_id", "client_email", "date_from", "date_to", "invoice_date",
  "company_name", "company_address", "line_items", "column_config", "notes", "status", "tax_label", "tax_rate",
] as const;

const NULLABLE_TEXT = ["client_email", "company_name", "company_address", "notes", "tax_label"];

export async function buildInvoiceWrite(
  supabase: Supabase,
  body: Record<string, unknown>,
  companyId: string,
  existing: { tax_rate: number | null } | null,
): Promise<{ row: Record<string, unknown>; error?: string }> {
  const row = pickFields(body, INVOICE_FIELDS);

  for (const f of NULLABLE_TEXT) {
    if (f in row) row[f] = typeof row[f] === "string" && (row[f] as string).trim() ? (row[f] as string).trim() : null;
  }
  if ("status" in row && row.status !== "draft" && row.status !== "sent") return { row, error: "Invalid status" };
  if ("tax_rate" in row) {
    const n = parseFloat(String(row.tax_rate ?? ""));
    row.tax_rate = Number.isFinite(n) && n > 0 ? n : null;
  }
  if ("client_id" in row || "client_name" in row) {
    row.client_id = await resolveClientId(supabase, row.client_id, row.client_name, companyId);
  }

  if ("line_items" in row) {
    if (!Array.isArray(row.line_items)) return { row, error: "line_items must be a list" };
    const rate = "tax_rate" in row ? row.tax_rate : existing?.tax_rate;
    const t = computeTotals(row.line_items as { amount: number | string }[], rate as number | null);
    row.subtotal = t.subtotal;
    row.tax_amount = t.taxAmount;
    row.total = t.total;
  }
  if ("column_config" in row && !Array.isArray(row.column_config)) row.column_config = [];

  return { row };
}
