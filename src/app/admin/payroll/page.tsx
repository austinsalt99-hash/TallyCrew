"use client";

import { useEffect, useState } from "react";
import {
  type PayPeriod,
  type PayPeriodType,
  getCurrentPeriod,
  getAdjacentPeriod,
  formatPeriodLabel,
} from "@/lib/payPeriod";

interface TypeBucket {
  slug: string;
  typeName: string;
  hours: number;
}

interface JobBucket {
  jobKey: string;
  title: string;
  hours: number;
}

interface EmployeeRow {
  userId: string;
  employeeName: string;
  billableHours: number;
  nonBillableHours: number;
  totalHours: number;
  byType: TypeBucket[];
  byJob: JobBucket[];
}

interface PayrollResponse {
  periodStart: string;
  periodEnd: string;
  paid: boolean;
  paidAt: string | null;
  employees: EmployeeRow[];
}

function fmtHours(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(2)}h`;
}

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv(data: PayrollResponse) {
  const header = ["Employee", "Total Hours", "Non-Billable Hours", "Breakdown"];
  const rows = data.employees.map((e) => [
    e.employeeName,
    e.totalHours.toString(),
    e.nonBillableHours.toString(),
    e.byType.map((t) => `${t.typeName}: ${t.hours}h`).join("; "),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${data.periodStart}_to_${data.periodEnd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PayrollPage() {
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [payPeriodType, setPayPeriodType] = useState<PayPeriodType>("biweekly");
  const [payPeriodAnchor, setPayPeriodAnchor] = useState("2024-01-01");
  const [period, setPeriod] = useState<PayPeriod | null>(null);
  const [data, setData] = useState<PayrollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [breakdownTab, setBreakdownTab] = useState<Record<string, "type" | "job">>({});

  useEffect(() => {
    fetch("/api/company", { credentials: "include" })
      .then((r) => r.json())
      .then((company) => {
        const type: PayPeriodType = company.pay_period_type ?? "biweekly";
        const anchor: string = company.pay_period_anchor ?? "2024-01-01";
        setPayPeriodType(type);
        setPayPeriodAnchor(anchor);
        setPeriod(getCurrentPeriod(type, anchor));
        setScheduleLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!period) return;
    setLoading(true);
    fetch(`/api/payroll?start=${period.start}&end=${period.end}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false); });
  }, [period]);

  function goToAdjacent(direction: 1 | -1) {
    if (!period) return;
    setPeriod(getAdjacentPeriod(period, payPeriodType, payPeriodAnchor, direction));
  }

  function toggleExpanded(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function togglePaid() {
    if (!data) return;
    setMarking(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ periodStart: data.periodStart, periodEnd: data.periodEnd, paid: !data.paid }),
      });
      if (res.ok) {
        setData({ ...data, paid: !data.paid, paidAt: !data.paid ? new Date().toISOString() : null });
      }
    } finally {
      setMarking(false);
    }
  }

  const totalPeriodHours = data ? Math.round(data.employees.reduce((s, e) => s + e.totalHours, 0) * 100) / 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        {data && data.employees.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(data)}
            className="text-xs font-semibold text-navy-600 border border-navy-200 rounded-lg px-3 py-2 hover:bg-navy-50 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Period navigator */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToAdjacent(-1)}
          disabled={!scheduleLoaded}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{period ? formatPeriodLabel(period) : "—"}</p>
          {data && (
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${data.paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {data.paid ? "Paid" : "Unpaid"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => goToAdjacent(1)}
          disabled={!scheduleLoaded}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
        </button>
      </div>

      {data && data.employees.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Period total</p>
            <p className="text-sm font-semibold text-gray-900">{fmtHours(totalPeriodHours)}</p>
          </div>
          <button
            type="button"
            onClick={togglePaid}
            disabled={marking}
            className={`text-xs font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-50 ${
              data.paid ? "text-gray-600 border border-gray-200 hover:bg-gray-50" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {marking ? "Saving…" : data.paid ? "Mark as unpaid" : "Mark period as paid"}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Employee hours</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tap an employee to see where their hours came from.</p>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-gray-400">Loading…</p>
        ) : !data || data.employees.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No hours logged in this period.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.employees.map((e) => {
              const isOpen = expanded.has(e.userId);
              const tab = breakdownTab[e.userId] ?? "type";
              const list = tab === "type" ? e.byType : e.byJob;
              return (
                <div key={e.userId}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(e.userId)}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{e.employeeName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{fmtHours(e.totalHours)}</p>
                      <span className="text-gray-400 text-[10px]">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBreakdownTab((prev) => ({ ...prev, [e.userId]: "type" }))}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tab === "type" ? "bg-navy-600 text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                          By type
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreakdownTab((prev) => ({ ...prev, [e.userId]: "job" }))}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tab === "job" ? "bg-navy-600 text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                          By job
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                        {list.length === 0 ? (
                          <p className="text-xs text-gray-400">No breakdown available.</p>
                        ) : (
                          list.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 truncate pr-2">{"typeName" in item ? item.typeName : item.title}</span>
                              <span className="font-semibold text-gray-900 shrink-0">{fmtHours(item.hours)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
