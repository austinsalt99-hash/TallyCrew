// Shared formatting rules for invoice line items — used by both the live
// editor preview (InvoiceForm.tsx) and the printable/PDF view ([id]/page.tsx)
// so what an admin sees while editing matches what gets exported, on any device.

export interface ColumnDef {
  id: string;
  label: string;
  type: "date" | "employee" | "description" | "rate" | "hours" | "amount" | "custom";
  visible: boolean;
}

export const DEFAULT_INVOICE_COLUMNS: ColumnDef[] = [
  { id: "date",        label: "Date",        type: "date",        visible: true },
  { id: "employee",    label: "Employee",    type: "employee",    visible: true },
  { id: "description", label: "Description", type: "description", visible: true },
  { id: "rate",        label: "Rate",        type: "rate",        visible: true },
  { id: "hours",       label: "Hours",       type: "hours",       visible: true },
  { id: "amount",      label: "Amount",      type: "amount",      visible: true },
];

export type RateBasis = "hour" | "unit";

export interface InvoiceLineItemLike {
  // Bold heading for the line, e.g. "Machine Operating – 135"
  title?: string;
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: number | string;
  rate?: string;
  // What the rate multiplies: hours worked, or units used (per-unit materials etc.)
  rateBasis?: RateBasis;
  units?: number;
  customValues?: Record<string, string>;
}

// The description to print under a line's title — blank when it would just
// repeat the title (hour-log lines often have no detail beyond it).
export function lineDescription(item: { title?: string; description: string }): string {
  const d = (item.description ?? "").trim();
  return d && d.toLowerCase() !== (item.title ?? "").trim().toLowerCase() ? d : "";
}

// Pulls the number out of a typed rate ("$35/hr", "35", "1,200") so the amount
// can be recalculated. Text with no number ("per job") returns null and the
// amount is left as the admin typed it.
export function parseRateNumber(rate: string | undefined): number | null {
  if (!rate) return null;
  const match = rate.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// "unit" if the rate text says so, "hour" if it says hr/hour, otherwise keep the current basis.
export function basisFromRateText(rate: string, fallback: RateBasis): RateBasis {
  const t = rate.toLowerCase();
  if (/unit|flat|each/.test(t)) return "unit";
  if (/hr|hour/.test(t)) return "hour";
  return fallback;
}

export function formatInvoiceDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function invoiceColHeaderClass(col: ColumnDef): string {
  const base = "py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  if (col.type === "hours") return `${base} text-right pr-3 w-14`;
  if (col.type === "amount") return `${base} text-right w-20`;
  if (col.type === "rate") return `${base} text-right pr-3 w-20`;
  if (col.type === "date") return `${base} text-left pr-3 w-24`;
  if (col.type === "employee") return `${base} text-left pr-3 w-28`;
  return `${base} text-left pr-3`;
}

// Rate is free text the admin types themselves (e.g. "$35/hr", "per job") —
// it must never get a "$" prepended here, or typed-in symbols double up.
export function formatInvoiceCell(col: ColumnDef, item: InvoiceLineItemLike): string {
  switch (col.type) {
    case "date": return item.date || "—";
    case "employee": return item.employee || "—";
    case "description": return item.description || "—";
    case "rate": return item.rate || "—";
    case "hours":
      if (item.rateBasis === "unit") {
        return item.units != null ? `${item.units} unit${item.units === 1 ? "" : "s"}` : "—";
      }
      return item.hours !== "" && item.hours !== 0 ? `${item.hours}h` : "—";
    case "amount": return `$${(parseFloat(String(item.amount)) || 0).toFixed(2)}`;
    case "custom": return item.customValues?.[col.id] || "—";
  }
}

// Quotes are written before any work happens, so the date and employee
// columns start hidden. Admins can still switch them on.
export const DEFAULT_QUOTE_COLUMNS: ColumnDef[] = DEFAULT_INVOICE_COLUMNS.map((c) =>
  c.type === "date" || c.type === "employee" ? { ...c, visible: false } : c,
);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DocumentTotals {
  subtotal: number;
  taxRate: number;   // percent; 0 when no tax was entered
  taxAmount: number;
  total: number;
}

// Tax is whatever rate the admin typed in — TallyCrew never decides it.
export function computeTotals(
  items: { amount: number | string }[],
  taxRate: number | string | null | undefined,
): DocumentTotals {
  const subtotal = round2(items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0));
  const rate = Math.max(0, parseFloat(String(taxRate ?? "")) || 0);
  const taxAmount = rate > 0 ? round2((subtotal * rate) / 100) : 0;
  return { subtotal, taxRate: rate, taxAmount, total: round2(subtotal + taxAmount) };
}

export type DepositType = "amount" | "percent";

export function depositAmount(total: number, type: DepositType | null | undefined, value: number | string | null | undefined): number {
  const v = parseFloat(String(value ?? "")) || 0;
  if (!type || v <= 0) return 0;
  return round2(type === "percent" ? (total * v) / 100 : v);
}

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export const PAYMENT_METHODS = [
  { value: "etransfer", label: "E-transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
