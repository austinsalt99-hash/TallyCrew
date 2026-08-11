"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "../_components/InvoiceForm";

interface LineItem {
  description: string;
  notes?: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: number | string;
  rate?: string;
  customValues?: Record<string, string>;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  date_from: string;
  date_to: string;
  invoice_date: string;
  company_name?: string;
  company_address?: string;
  line_items: LineItem[];
  column_config?: ColumnDef[];
  total: number;
  notes?: string;
  status: "draft" | "sent" | "paid";
}

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-navy-100 text-navy-700",
  paid: "bg-green-100 text-green-700",
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "date",        label: "Date",        type: "date",        visible: true },
  { id: "employee",    label: "Employee",    type: "employee",    visible: true },
  { id: "description", label: "Description", type: "description", visible: true },
  { id: "rate",        label: "Rate",        type: "rate",        visible: true },
  { id: "hours",       label: "Hours",       type: "hours",       visible: true },
  { id: "amount",      label: "Amount",      type: "amount",      visible: true },
];

function thClass(col: ColumnDef) {
  const base = "text-xs font-semibold text-gray-500 uppercase tracking-wide py-2";
  if (col.type === "hours" || col.type === "rate" || col.type === "amount") return `${base} text-right pr-4`;
  return `${base} text-left pr-4`;
}

function cellValue(col: ColumnDef, item: LineItem): string {
  switch (col.type) {
    case "date": return item.date || "—";
    case "employee": return item.employee || "—";
    case "description": return item.description || "—";
    case "rate": return item.rate ? `$${item.rate}` : "—";
    case "hours": return item.hours !== "" && item.hours !== 0 ? `${item.hours}h` : "—";
    case "amount": return `$${parseFloat(String(item.amount) || "0").toFixed(2)}`;
    case "custom": return item.customValues?.[col.id] || "—";
  }
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => { setInvoice(data); setLoading(false); });
  }, [id]);

  useEffect(() => {
    fetch("/api/company", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data.invoice_logo_url ?? null))
      .catch(() => {});
  }, []);

  async function setStatus(status: "draft" | "sent" | "paid") {
    await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    setInvoice((prev) => prev ? { ...prev, status } : prev);
  }

  async function deleteInvoice() {
    await fetch(`/api/invoices/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    router.push("/admin/invoices");
  }

  if (loading) return <p className="text-gray-500">Loading invoice...</p>;
  if (!invoice) return <p className="text-red-500">Invoice not found.</p>;

  const total = invoice.line_items.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);
  const columns = invoice.column_config && invoice.column_config.length > 0 ? invoice.column_config : DEFAULT_COLUMNS;
  const visibleCols = columns.filter((c) => c.visible);
  const colCount = Math.max(1, visibleCols.length);

  return (
    <div className="max-w-4xl">
      {/* Admin controls — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/admin/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[invoice.status]}`}>
          {invoice.status}
        </span>
        <div className="flex-1" />
        <Link
          href={`/admin/invoices/${id}/edit`}
          className="text-sm border border-navy-400 text-navy-600 hover:bg-navy-50 rounded-lg px-3 py-1.5 font-semibold"
        >
          ✏ Edit Invoice
        </Link>
        {invoice.status !== "draft" && (
          <button
            onClick={() => setStatus("draft")}
            className="text-sm border border-gray-300 text-gray-500 hover:bg-gray-50 rounded-lg px-3 py-1.5 font-medium"
          >
            Revert to Draft
          </button>
        )}
        {invoice.status !== "sent" && (
          <button
            onClick={() => setStatus("sent")}
            className="text-sm border border-navy-300 text-navy-600 hover:bg-navy-50 rounded-lg px-3 py-1.5 font-medium"
          >
            Mark as Sent
          </button>
        )}
        {invoice.status !== "paid" && (
          <button
            onClick={() => setStatus("paid")}
            className="text-sm border border-green-300 text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 font-medium"
          >
            Mark as Paid
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm"
        >
          Print / Save PDF
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Delete this invoice?</span>
            <button onClick={deleteInvoice} className="text-red-600 font-semibold hover:text-red-700">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-gray-400">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 hover:text-red-700">
            Delete
          </button>
        )}
      </div>

      {/* Printable invoice */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 print:border-0 print:rounded-none print:shadow-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="max-h-14 max-w-[220px] object-contain mb-2" />
            )}
            {invoice.company_name && (
              <div className="text-xl font-bold text-gray-900 mb-1">{invoice.company_name}</div>
            )}
            {invoice.company_address && (
              <div className="text-sm text-gray-500 whitespace-pre-line">{invoice.company_address}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-navy-600 mb-1">INVOICE</div>
            <div className="text-sm text-gray-600">
              <div><span className="font-medium">Invoice #:</span> {invoice.invoice_number}</div>
              <div><span className="font-medium">Date:</span> {formatDate(invoice.invoice_date)}</div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bill To</div>
          <div className="text-lg font-semibold text-gray-900">{invoice.client_name}</div>
          <div className="text-sm text-gray-500">
            Work performed: {formatDate(invoice.date_from)} – {formatDate(invoice.date_to)}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              {visibleCols.map((col) => <th key={col.id} className={thClass(col)}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item, i) => (
              <Fragment key={i}>
                <tr className={item.notes ? "" : "border-b border-gray-100"}>
                  {visibleCols.map((col) => (
                    <td
                      key={col.id}
                      className={`py-2 pr-4 last:pr-0 text-gray-700 ${
                        col.type === "amount" ? "text-right font-medium text-gray-900" : col.type === "hours" || col.type === "rate" ? "text-right text-gray-500" : ""
                      }`}
                    >
                      {cellValue(col, item)}
                    </td>
                  ))}
                </tr>
                {item.notes && (
                  <tr className="border-b border-gray-100">
                    <td colSpan={colCount} className="pb-2 pr-4 pt-0 text-xs text-gray-400 italic">{item.notes}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={Math.max(1, colCount - 1)} className="text-right py-3 pr-4 font-bold text-gray-700 text-base">Total</td>
              <td className="py-3 text-right font-bold text-navy-600 text-base">${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</div>
            <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Draft watermark */}
        {invoice.status === "draft" && (
          <div className="print:hidden mt-6 text-center text-xs text-gray-300 uppercase tracking-widest">
            — Draft —
          </div>
        )}
      </div>
    </div>
  );
}
