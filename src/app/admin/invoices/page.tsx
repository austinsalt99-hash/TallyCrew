"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  date_from: string;
  date_to: string;
  total: number;
  status: "draft" | "sent" | "paid";
  created_at: string;
}

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => { setInvoices(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  if (loading) return <p className="text-gray-500">Loading invoices...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Link
          href="/admin/invoices/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-2 text-sm"
        >
          + New Invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No invoices yet.{" "}
          <Link href="/admin/invoices/new" className="text-blue-600 underline">
            Create your first one.
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Invoice #</th>
                <th className="px-5 py-3 text-left">Client</th>
                <th className="px-5 py-3 text-left">Date Range</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => { window.location.href = `/admin/invoices/${inv.id}`; }}
                >
                  <td className="px-5 py-3 font-medium text-blue-600">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-gray-900">{inv.client_name}</td>
                  <td className="px-5 py-3 text-gray-500">{inv.date_from} – {inv.date_to}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">
                    ${Number(inv.total).toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[inv.status] ?? statusBadge.draft}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
