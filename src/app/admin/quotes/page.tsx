"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Quote, QuoteDisplayStatus } from "@/types/quote";
import { QUOTE_STATUS_BADGE, quoteDisplayStatus } from "@/types/quote";
import { formatInvoiceDate, formatMoney } from "../invoices/_components/invoiceFormat";
import BillingTabs from "../invoices/_components/BillingTabs";
import PaidProgress from "@/components/PaidProgress";

type Filter = "open" | QuoteDisplayStatus | "all";

const TABS: { label: string; value: Filter }[] = [
  { label: "Open", value: "open" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
  { label: "Expired", value: "expired" },
  { label: "All", value: "all" },
];

const STATUS_LABEL: Record<QuoteDisplayStatus, string> = {
  draft: "Draft", sent: "Sent", approved: "Approved", declined: "Declined", expired: "Expired",
};

// "Open" = still in play: not declined, not expired, and not yet invoiced.
function matches(q: Quote, filter: Filter): boolean {
  const shown = quoteDisplayStatus(q);
  if (filter === "all") return true;
  if (filter === "open") return shown !== "declined" && shown !== "expired" && !q.converted_invoice_id;
  return shown === filter;
}

function Tags({ q }: { q: Quote }) {
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {q.converted_job_id && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Scheduled</span>}
      {q.converted_invoice_id && <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">Invoiced</span>}
    </span>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");

  useEffect(() => {
    fetch("/api/quotes", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setQuotes(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const visible = quotes.filter((q) => matches(q, filter));

  if (loading) return <p className="text-gray-500">Loading quotes...</p>;

  return (
    <div>
      <BillingTabs active="quotes" />
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
        <Link href="/admin/quotes/new" className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm">
          + New Quote
        </Link>
      </div>

      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-full md:w-fit overflow-x-auto">
        {TABS.map((tab) => {
          const count = quotes.filter((q) => matches(q, tab.value)).length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={filter === tab.value ? { backgroundColor: "#0A1172" } : undefined}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                filter === tab.value ? "text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={filter === tab.value ? { backgroundColor: "rgba(255,255,255,0.2)" } : undefined}
                  className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${filter === tab.value ? "text-white" : "bg-gray-100 text-gray-500"}`}
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
          {filter === "open" || filter === "all" ? (
            <>No quotes here yet. <Link href="/admin/quotes/new" className="text-navy-600 underline">Create one.</Link></>
          ) : (
            `No ${STATUS_LABEL[filter as QuoteDisplayStatus].toLowerCase()} quotes.`
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Mobile: card list */}
          <div className="md:hidden divide-y divide-gray-100">
            {visible.map((q) => {
              const shown = quoteDisplayStatus(q);
              return (
                <div key={q.id} className="px-4 py-3.5 active:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/quotes/${q.id}`)}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm truncate">{q.title}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${QUOTE_STATUS_BADGE[shown]}`}>{STATUS_LABEL[shown]}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 truncate">
                      {q.quote_number} · {q.client || "No client"}{q.target_date ? ` · ${formatInvoiceDate(q.target_date)}` : ""}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">{formatMoney(Number(q.total) || 0)}</span>
                  </div>
                  <div className="mt-1.5"><Tags q={q} /></div>
                  {(q.amount_paid ?? 0) > 0 && (
                    <div className="mt-2"><PaidProgress paid={q.amount_paid ?? 0} total={Number(q.total) || 0} compact /></div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Quote #</th>
                <th className="px-5 py-3 text-left">Job</th>
                <th className="px-5 py-3 text-left">Client</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left w-44">Deposit</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => {
                const shown = quoteDisplayStatus(q);
                return (
                  <tr key={q.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/quotes/${q.id}`)}>
                    <td className="px-5 py-3 font-medium text-navy-600 whitespace-nowrap">{q.quote_number}</td>
                    <td className="px-5 py-3 text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{q.title}</span>
                        <Tags q={q} />
                      </div>
                      {q.target_date && <div className="text-xs text-gray-400">{formatInvoiceDate(q.target_date)}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{q.client || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatMoney(Number(q.total) || 0)}</td>
                    <td className="px-5 py-3">
                      {(q.amount_paid ?? 0) > 0
                        ? <PaidProgress paid={q.amount_paid ?? 0} total={Number(q.total) || 0} compact />
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${QUOTE_STATUS_BADGE[shown]}`}>{STATUS_LABEL[shown]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
