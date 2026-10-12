import type { createSupabaseServer } from "@/lib/supabase-server";
import { ownsRow, pickFields, resolveClientId } from "@/lib/billing";
import { computeTotals } from "@/app/admin/invoices/_components/invoiceFormat";

type Supabase = Awaited<ReturnType<typeof createSupabaseServer>>;

// Only these columns may be set from a request body — company_id, totals,
// converted_invoice_id and timestamps are always set by the server.
const QUOTE_FIELDS = [
  "quote_number", "quote_date", "title", "client", "client_id", "client_email", "client_phone",
  "location", "description", "terms", "target_date", "valid_until", "status", "converted_job_id",
  "company_name", "company_address", "line_items", "column_config", "tax_label", "tax_rate",
  "deposit_type", "deposit_value",
] as const;

const STATUSES = ["draft", "sent", "approved", "declined"];
const NULLABLE_TEXT = [
  "quote_number", "client", "client_email", "client_phone", "location", "description", "terms",
  "target_date", "valid_until", "company_name", "company_address", "tax_label",
];

export function nextQuoteNumber(existing: (string | null)[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map((n) => { const m = n?.match(/^Q-(\d{4})-(\d+)$/); return m && Number(m[1]) === year ? parseInt(m[2]) : 0; })
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `Q-${year}-${String(next).padStart(3, "0")}`;
}

// Turns a request body into a safe quotes row update. `existing` is the
// current row on an update, null on create.
export async function buildQuoteWrite(
  supabase: Supabase,
  body: Record<string, unknown>,
  companyId: string,
  existing: { tax_rate: number | null; sent_at: string | null; status: string } | null,
): Promise<{ row: Record<string, unknown>; error?: string }> {
  const row = pickFields(body, QUOTE_FIELDS);

  if ("title" in row) {
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!title) return { row, error: "Title required" };
    row.title = title;
  }
  for (const f of NULLABLE_TEXT) {
    if (f in row) row[f] = typeof row[f] === "string" && (row[f] as string).trim() ? (row[f] as string).trim() : null;
  }
  if ("quote_date" in row && !row.quote_date) delete row.quote_date;

  if ("status" in row && !STATUSES.includes(row.status as string)) return { row, error: "Invalid status" };
  if ("deposit_type" in row && row.deposit_type !== "amount" && row.deposit_type !== "percent") row.deposit_type = null;
  for (const f of ["tax_rate", "deposit_value"]) {
    if (f in row) {
      const n = parseFloat(String(row[f] ?? ""));
      row[f] = Number.isFinite(n) && n > 0 ? n : null;
    }
  }

  if ("client_id" in row || "client" in row) row.client_id = await resolveClientId(supabase, row.client_id, row.client, companyId);
  if ("converted_job_id" in row && row.converted_job_id != null) {
    if (!(await ownsRow(supabase, "job_events", row.converted_job_id, companyId))) row.converted_job_id = null;
  }

  if ("line_items" in row) {
    if (!Array.isArray(row.line_items)) return { row, error: "line_items must be a list" };
    const rate = "tax_rate" in row ? row.tax_rate : existing?.tax_rate;
    const t = computeTotals(row.line_items as { amount: number | string }[], rate as number | null);
    row.subtotal = t.subtotal;
    row.tax_amount = t.taxAmount;
    row.total = t.total;
    // Kept in step for anything still reading the old single-price field
    row.estimated_price = t.total;
  }
  if ("column_config" in row && !Array.isArray(row.column_config)) row.column_config = [];

  if (row.status === "sent" && !existing?.sent_at) row.sent_at = new Date().toISOString();
  if ((row.status === "approved" || row.status === "declined") && row.status !== existing?.status) {
    row.responded_at = new Date().toISOString();
  }
  if (row.status === "draft") { row.sent_at = null; row.responded_at = null; }

  return { row };
}
