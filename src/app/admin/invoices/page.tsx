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
  sent: "bg-navy-100 text-navy-700",
  paid: "bg-green-100 text-green-700",
};

type Filter = "all" | "draft" | "sent" | "paid";

const TABS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => { setInvoices(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const visible = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter);

  if (loading) return <p className="text-gray-500">Loading invoices...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Link
          href="/admin/invoices/new"
          className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm"
        >
          + New Invoice
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {TABS.map((tab) => {
          const count = tab.value === "all"
            ? invoices.length
            : invoices.filter((i) => i.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={filter === tab.value ? { backgroundColor: "#0A1172" } : undefined}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                filter === tab.value ? "text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={filter === tab.value ? { backgroundColor: "rgba(255,255,255,0.2)" } : undefined}
                  className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${
                    filter === tab.value ? "text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          {filter === "all" ? (
            <>No invoices yet. <Link href="/admin/invoices/new" className="text-navy-600 underline">Create your first one.</Link></>
          ) : (
            `No ${filter} invoices.`
          )}
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
              {visible.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => { window.location.href = `/admin/invoices/${inv.id}`; }}
                >
                  <td className="px-5 py-3 font-medium text-navy-600">{inv.invoice_number}</td>
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
