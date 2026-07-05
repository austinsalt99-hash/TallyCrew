"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface LineItem {
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: number | string;
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
  total: number;
  notes?: string;
  status: "draft" | "sent" | "paid";
}

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-navy-100 text-navy-700",
  paid: "bg-green-100 text-green-700",
};

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

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => { setInvoice(data); setLoading(false); });
  }, [id]);

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

  return (
    <div className="max-w-4xl">
      {/* Admin controls — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/admin/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[invoice.status]}`}>
          {invoice.status}
        </span>
        <div className="flex-1" />
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
            <tr className="border-b-2 border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="text-left py-2 pr-4">Date</th>
              <th className="text-left py-2 pr-4">Employee</th>
              <th className="text-left py-2 pr-4">Description</th>
              <th className="text-right py-2 pr-4">Hours</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-600">{item.date}</td>
                <td className="py-2 pr-4 text-gray-700">{item.employee}</td>
                <td className="py-2 pr-4 text-gray-700">{item.description || "—"}</td>
                <td className="py-2 pr-4 text-right text-gray-500">{item.hours !== "" && item.hours !== 0 ? `${item.hours}h` : "—"}</td>
                <td className="py-2 text-right font-medium text-gray-900">
                  ${parseFloat(String(item.amount) || "0").toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right py-3 pr-4 font-bold text-gray-700 text-base">Total</td>
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
