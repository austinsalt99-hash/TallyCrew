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

export interface InvoiceLineItemLike {
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: number | string;
  rate?: string;
  customValues?: Record<string, string>;
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
    case "hours": return item.hours !== "" && item.hours !== 0 ? `${item.hours}h` : "—";
    case "amount": return `$${(parseFloat(String(item.amount)) || 0).toFixed(2)}`;
    case "custom": return item.customValues?.[col.id] || "—";
  }
}
