"use client";

import { useEffect, useState } from "react";

interface SubmissionSummary {
  total_billable_hours: number;
  total_non_billable_hours: number;
}

interface WeekSummary {
  totalBillable: number;
  totalNonBillable: number;
  daysLogged: number;
  from: Date;
  to: Date;
}

function getWeekRange(): { from: string; to: string; fromDate: Date; toDate: Date } {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(monday), to: fmt(sunday), fromDate: monday, toDate: sunday };
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WeeklyHoursSummary() {
  const [summary, setSummary] = useState<WeekSummary | null>(null);

  useEffect(() => {
    const { from, to, fromDate, toDate } = getWeekRange();
    fetch(`/api/submissions/employee?from=${from}&to=${to}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: SubmissionSummary[]) => {
        if (!Array.isArray(data)) return;
        setSummary({
          totalBillable: Math.round(data.reduce((s, d) => s + (d.total_billable_hours || 0), 0) * 100) / 100,
          totalNonBillable: Math.round(data.reduce((s, d) => s + (d.total_non_billable_hours || 0), 0) * 100) / 100,
          daysLogged: data.length,
          from: fromDate,
          to: toDate,
        });
      })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const total = Math.round((summary.totalBillable + summary.totalNonBillable) * 100) / 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5DB941" }}>This Week</p>
        <p className="text-xs text-gray-400">{fmtShort(summary.from)} – {fmtShort(summary.to)}</p>
      </div>
      <div className="flex items-center gap-5">
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{total}h</p>
          <p className="text-xs text-gray-400 mt-1">total</p>
        </div>
        <div className="h-8 w-px bg-gray-100 shrink-0" />
        <div>
          <p className="text-base font-semibold text-blue-600 leading-none">{summary.totalBillable}h</p>
          <p className="text-xs text-gray-400 mt-1">billable</p>
        </div>
        <div>
          <p className="text-base font-semibold text-orange-500 leading-none">{summary.totalNonBillable}h</p>
          <p className="text-xs text-gray-400 mt-1">non-billable</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-base font-semibold text-gray-700 leading-none">{summary.daysLogged}</p>
          <p className="text-xs text-gray-400 mt-1">days logged</p>
        </div>
      </div>
    </div>
  );
}
