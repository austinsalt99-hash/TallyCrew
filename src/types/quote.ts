import type { ColumnDef, DepositType, InvoiceLineItemLike } from "@/app/admin/invoices/_components/invoiceFormat";

export type QuoteStatus = "draft" | "sent" | "approved" | "declined";

export interface Quote {
  id: string;
  quote_number: string | null;
  quote_date: string;
  title: string;
  client: string | null;
  client_id: string | null;
  client_email: string | null;
  client_phone: string | null;
  location: string | null;
  // Shown on the quote as its notes
  description: string | null;
  terms: string | null;
  estimated_price: number | null;
  target_date: string | null;
  valid_until: string | null;
  status: QuoteStatus;
  converted_job_id: string | null;
  converted_invoice_id: string | null;
  company_name: string | null;
  company_address: string | null;
  line_items: InvoiceLineItemLike[];
  column_config: ColumnDef[];
  subtotal: number | null;
  tax_label: string | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number;
  deposit_type: DepositType | null;
  deposit_value: number | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
  // Added by GET /api/quotes and /api/quotes/[id] from the payments table
  amount_paid?: number;
}

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// A quote nobody answered before its "valid until" date. Worked out on
// display rather than stored, so nothing has to run in the background.
export function isQuoteExpired(q: Pick<Quote, "status" | "valid_until">): boolean {
  return (q.status === "draft" || q.status === "sent") && !!q.valid_until && q.valid_until < todayLocal();
}

export type QuoteDisplayStatus = QuoteStatus | "expired";

export function quoteDisplayStatus(q: Pick<Quote, "status" | "valid_until">): QuoteDisplayStatus {
  return isQuoteExpired(q) ? "expired" : q.status;
}

export const QUOTE_STATUS_BADGE: Record<QuoteDisplayStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-navy-100 text-navy-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-600",
  expired: "bg-amber-100 text-amber-700",
};
