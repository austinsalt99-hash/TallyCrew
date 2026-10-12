// One shape for anything printed as a quote or an invoice, so the on-screen
// view (DocumentSheet) and the PDF (lib/invoicePdf.ts) are built from the same data.
import type { ColumnDef, DepositType, InvoiceLineItemLike } from "./invoiceFormat";
import {
  DEFAULT_INVOICE_COLUMNS, DEFAULT_QUOTE_COLUMNS, computeTotals, depositAmount, formatInvoiceDate, formatMoney,
} from "./invoiceFormat";

export type DocKind = "invoice" | "quote";

export interface DocumentModel {
  kind: DocKind;
  heading: string;            // "INVOICE" / "QUOTE"
  numberLabel: string;        // "Invoice #" / "Quote #"
  number: string;
  date: string;               // YYYY-MM-DD
  extraHeaderLines: string[]; // e.g. "Valid until: …"
  partyLabel: string;         // "Bill To" / "Prepared For"
  clientName: string;
  clientLines: string[];      // job, location, work dates…
  companyName?: string | null;
  companyAddress?: string | null;
  lineItems: InvoiceLineItemLike[];
  columns: ColumnDef[];
  notes?: string | null;
  terms?: string | null;
  taxLabel?: string | null;
  taxRate?: number | null;
  amountPaid: number;
  depositNote?: string | null;
  isDraft: boolean;
}

export interface InvoiceRecord {
  invoice_number: string;
  invoice_date: string;
  client_name: string;
  date_from: string;
  date_to: string;
  company_name?: string | null;
  company_address?: string | null;
  line_items: InvoiceLineItemLike[];
  column_config?: ColumnDef[] | null;
  notes?: string | null;
  tax_label?: string | null;
  tax_rate?: number | null;
  status: string;
  amount_paid?: number;
}

export interface QuoteRecord {
  quote_number: string | null;
  quote_date: string;
  title: string;
  client: string | null;
  location: string | null;
  target_date: string | null;
  valid_until: string | null;
  company_name?: string | null;
  company_address?: string | null;
  line_items: InvoiceLineItemLike[];
  column_config?: ColumnDef[] | null;
  description?: string | null;
  terms?: string | null;
  tax_label?: string | null;
  tax_rate?: number | null;
  deposit_type?: DepositType | null;
  deposit_value?: number | null;
  status: string;
  amount_paid?: number;
}

export function invoiceToDocument(inv: InvoiceRecord): DocumentModel {
  const clientLines: string[] = [];
  if (inv.date_from || inv.date_to) {
    const from = inv.date_from ? formatInvoiceDate(inv.date_from) : "—";
    const to = inv.date_to ? formatInvoiceDate(inv.date_to) : "—";
    clientLines.push(`Work performed: ${from} – ${to}`);
  }
  return {
    kind: "invoice",
    heading: "INVOICE",
    numberLabel: "Invoice #",
    number: inv.invoice_number,
    date: inv.invoice_date,
    extraHeaderLines: [],
    partyLabel: "Bill To",
    clientName: inv.client_name,
    clientLines,
    companyName: inv.company_name,
    companyAddress: inv.company_address,
    lineItems: inv.line_items ?? [],
    columns: inv.column_config && inv.column_config.length > 0 ? inv.column_config : DEFAULT_INVOICE_COLUMNS,
    notes: inv.notes,
    taxLabel: inv.tax_label,
    taxRate: inv.tax_rate,
    amountPaid: inv.amount_paid ?? 0,
    isDraft: inv.status === "draft",
  };
}

export function quoteDepositNote(
  total: number, type: DepositType | null | undefined, value: number | string | null | undefined,
): string | null {
  const amt = depositAmount(total, type, value);
  if (amt <= 0) return null;
  return type === "percent" ? `Deposit required: ${formatMoney(amt)} (${value}%)` : `Deposit required: ${formatMoney(amt)}`;
}

export function quoteToDocument(q: QuoteRecord): DocumentModel {
  const clientLines: string[] = [];
  if (q.title) clientLines.push(`Job: ${q.title}`);
  if (q.location) clientLines.push(`Location: ${q.location}`);
  if (q.target_date) clientLines.push(`Planned start: ${formatInvoiceDate(q.target_date)}`);
  const { total } = computeTotals(q.line_items ?? [], q.tax_rate);
  return {
    kind: "quote",
    heading: "QUOTE",
    numberLabel: "Quote #",
    number: q.quote_number ?? "",
    date: q.quote_date,
    extraHeaderLines: q.valid_until ? [`Valid until: ${formatInvoiceDate(q.valid_until)}`] : [],
    partyLabel: "Prepared For",
    clientName: q.client ?? "",
    clientLines,
    companyName: q.company_name,
    companyAddress: q.company_address,
    lineItems: q.line_items ?? [],
    columns: q.column_config && q.column_config.length > 0 ? q.column_config : DEFAULT_QUOTE_COLUMNS,
    notes: q.description,
    terms: q.terms,
    taxLabel: q.tax_label,
    taxRate: q.tax_rate,
    amountPaid: q.amount_paid ?? 0,
    depositNote: quoteDepositNote(total, q.deposit_type, q.deposit_value),
    isDraft: q.status === "draft",
  };
}
