"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseDateStr, formatDateStr } from "@/lib/dateMath";

interface WorkerTaxRow {
  userId: string;
  employeeName: string;
  workerType: "w2" | "1099";
  payRate: number | null;
  billableHours: number;
  nonBillableHours: number;
  totalHours: number;
  grossPay: number | null;
}

interface PaidInvoiceRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  paidAt: string;
  total: number;
}

interface FinancialsResponse {
  start: string;
  end: string;
  workers: WorkerTaxRow[];
  revenue: { total: number; invoices: PaidInvoiceRow[] };
}

type Mode = "year" | "range";

function fmtHours(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(2)}h`;
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateLabel(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTimestampLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv(rows: WorkerTaxRow[], start: string, end: string) {
  const header = ["Employee", "Classification", "Total Hours", "Pay Rate", "Gross Pay", "Period Start", "Period End"];
  const csvRows = rows.map((w) => [
    w.employeeName,
    w.workerType === "w2" ? "W-2 Employee" : "1099 Contractor",
    w.totalHours.toString(),
    w.payRate != null ? w.payRate.toFixed(2) : "",
    w.grossPay != null ? w.grossPay.toFixed(2) : "",
    start,
    end,
  ]);
  const csv = [header, ...csvRows].map((row) => row.map(csvField).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tax_info_${start}_to_${end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinancialsPage() {
  const currentYear = new Date().getFullYear();
  const today = formatDateStr(new Date());

  const [mode, setMode] = useState<Mode>("year");
  const [year, setYear] = useState(currentYear);
  const [rangeStart, setRangeStart] = useState(`${currentYear}-01-01`);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [workerFilter, setWorkerFilter] = useState("all");

  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvoices, setShowInvoices] = useState(false);

  useEffect(() => {
    const params = mode === "year" ? `year=${year}` : `start=${rangeStart}&end=${rangeEnd}`;
    fetch(`/api/admin/financials?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false); });
  }, [mode, year, rangeStart, rangeEnd]);

  function changeMode(next: Mode) {
    setLoading(true);
    setMode(next);
  }

  function changeYear(next: number) {
    setLoading(true);
    setYear(next);
  }

  function changeRangeStart(v: string) {
    setLoading(true);
    setRangeStart(v);
  }

  function changeRangeEnd(v: string) {
    setLoading(true);
    setRangeEnd(v);
  }

  const allWorkers = data?.workers ?? [];
  const displayedWorkers = workerFilter === "all" ? allWorkers : allWorkers.filter((w) => w.userId === workerFilter);

  const missingRate = displayedWorkers.filter((w) => w.payRate == null);
  const totalGrossPay = Math.round(displayedWorkers.reduce((s, w) => s + (w.grossPay ?? 0), 0) * 100) / 100;
  const allWorkersGrossPay = Math.round(allWorkers.reduce((s, w) => s + (w.grossPay ?? 0), 0) * 100) / 100;
  const netAmount = data ? Math.round((data.revenue.total - allWorkersGrossPay) * 100) / 100 : 0;

  const periodLabel = data ? `${fmtDateLabel(data.start)} – ${fmtDateLabel(data.end)}` : "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
        {data && displayedWorkers.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(displayedWorkers, data.start, data.end)}
            className="text-xs font-semibold text-navy-600 border border-navy-200 rounded-lg px-3 py-2 hover:bg-navy-50 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      <div className="bg-navy-50 border border-navy-200 rounded-xl px-4 py-3">
        <p className="text-sm text-navy-800">
          This is a record of hours, pay rate, and classification for your own reference and to hand to
          your accountant or payroll provider. TallyCrew does not calculate withholding, file taxes, or
          store SSNs/EINs.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => changeMode("year")}
          className={`flex-1 text-sm font-semibold rounded-xl py-2.5 border transition-colors ${
            mode === "year" ? "bg-navy-600 text-white border-navy-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          By year
        </button>
        <button
          type="button"
          onClick={() => changeMode("range")}
          className={`flex-1 text-sm font-semibold rounded-xl py-2.5 border transition-colors ${
            mode === "range" ? "bg-navy-600 text-white border-navy-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Custom range
        </button>
      </div>

      {mode === "year" ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeYear(year - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <p className="text-sm font-semibold text-gray-900">{year}</p>
          <button
            type="button"
            onClick={() => changeYear(year + 1)}
            disabled={year >= currentYear}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">From</label>
            <input
              type="date"
              value={rangeStart}
              max={rangeEnd}
              onChange={(e) => changeRangeStart(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">To</label>
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart}
              max={today}
              onChange={(e) => changeRangeEnd(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
        </div>
      )}

      {/* Revenue */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setShowInvoices((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-xs text-gray-400">Revenue collected, {periodLabel}</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(data.revenue.total)}</p>
            </div>
            {data.revenue.invoices.length > 0 && (
              <span className="text-gray-400 text-[10px] shrink-0">{showInvoices ? "▲" : "▼"}</span>
            )}
          </button>
          {showInvoices && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {data.revenue.invoices.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No invoices marked paid in this range.</p>
              ) : (
                data.revenue.invoices.map((inv) => (
                  <div key={inv.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{inv.clientName}</p>
                      <p className="text-xs text-gray-400">#{inv.invoiceNumber} · Paid {fmtTimestampLabel(inv.paidAt)}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">{fmtMoney(inv.total)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {data && workerFilter === "all" && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Net (revenue − gross pay), {periodLabel}</p>
          <p className={`text-lg font-bold ${netAmount < 0 ? "text-red-600" : "text-gray-900"}`}>{fmtMoney(netAmount)}</p>
        </div>
      )}

      {allWorkers.length > 0 && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Worker</label>
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
            <option value="all">All workers</option>
            {allWorkers.map((w) => (
              <option key={w.userId} value={w.userId}>{w.employeeName}</option>
            ))}
          </select>
        </div>
      )}

      {displayedWorkers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Total gross pay, {periodLabel}</p>
          <p className="text-lg font-bold text-gray-900">{fmtMoney(totalGrossPay)}</p>
        </div>
      )}

      {!loading && missingRate.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            {missingRate.length === 1
              ? `${missingRate[0].employeeName} has no pay rate set, so gross pay can't be calculated.`
              : `${missingRate.length} workers have no pay rate set, so gross pay can't be calculated for them.`}{" "}
            <Link href="/admin/workers" className="font-semibold underline">Set pay rates</Link>
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Workers</h2>
          <p className="text-xs text-gray-400 mt-0.5">Hours and gross pay, {periodLabel || "…"}.</p>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-gray-400">Loading…</p>
        ) : displayedWorkers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No hours logged in this range.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayedWorkers.map((w) => (
              <div key={w.userId} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm truncate">{w.employeeName}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      w.workerType === "w2" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {w.workerType === "w2" ? "Employee" : "Contractor"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtHours(w.totalHours)}{w.payRate != null ? ` · ${fmtMoney(w.payRate)}/hr` : " · no pay rate set"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 shrink-0">
                  {w.grossPay != null ? fmtMoney(w.grossPay) : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
