"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const BILLABLE_COLOR = "#2563eb";
const NON_BILLABLE_COLOR = "#f97316";
const NAVY = "#0A1172";

type RangeKey = "month" | "quarter" | "ytd" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "month", label: "This Month" },
  { key: "quarter", label: "Last 3 Months" },
  { key: "ytd", label: "Year to Date" },
  { key: "all", label: "All Time" },
];

interface TypeBucket {
  slug: string;
  typeName: string;
  hours: number;
}

interface WorkerRow {
  userId: string;
  employeeName: string;
  billableHours: number;
  nonBillableHours: number;
  totalHours: number;
  byType: TypeBucket[];
}

interface TrendPoint {
  periodStart: string;
  billableHours: number;
  nonBillableHours: number;
}

interface StatsResponse {
  range: RangeKey;
  start: string | null;
  end: string;
  granularity: "week" | "month";
  companyTotals: { billableHours: number; nonBillableHours: number; byType: TypeBucket[] };
  workers: WorkerRow[];
  trend: TrendPoint[];
}

function fmtHours(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

function fmtPeriodLabel(dateStr: string, granularity: "week" | "month"): string {
  const d = new Date(dateStr + "T00:00:00");
  if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function StatisticsPage() {
  const [range, setRange] = useState<RangeKey>("month");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/statistics?range=${range}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [range]);

  const trendChartData = useMemo(() => {
    if (!data) return [];
    return data.trend.map((t) => ({ ...t, label: fmtPeriodLabel(t.periodStart, data.granularity) }));
  }, [data]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
        <p className="text-sm text-gray-500 mt-1">
          See how billable and non-billable time breaks down across the team over time.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setRange(opt.key)}
            className={`shrink-0 text-sm font-semibold rounded-lg px-3 py-2 transition-colors ${
              range === opt.key
                ? "bg-navy-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Billable</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtHours(data.companyTotals.billableHours)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Non-billable</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtHours(data.companyTotals.nonBillableHours)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Hours over time</h2>
            {trendChartData.length === 0 ? (
              <p className="text-gray-400 text-sm">No submissions in this range.</p>
            ) : (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={trendChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                      formatter={(value, name) => [fmtHours(Number(value ?? 0)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="billableHours" name="Billable" fill={BILLABLE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="nonBillableHours" name="Non-billable" fill={NON_BILLABLE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold text-gray-900">By worker</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sorted by total hours logged. Tap a worker to see their breakdown by log type.</p>
            </div>
            {data.workers.length === 0 ? (
              <p className="text-gray-400 text-sm px-4 pb-4">No submissions in this range.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.workers.map((w) => {
                  const isOpen = expanded.has(w.userId);
                  const billablePct = w.totalHours > 0 ? (w.billableHours / w.totalHours) * 100 : 0;
                  const maxTypeHours = w.byType[0]?.hours || 1;
                  return (
                    <div key={w.userId}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(w.userId)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900 truncate">{w.employeeName}</span>
                            <span className="text-sm text-gray-500 shrink-0">{fmtHours(w.totalHours)}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                            <div style={{ width: `${billablePct}%`, backgroundColor: BILLABLE_COLOR }} />
                            <div style={{ width: `${100 - billablePct}%`, backgroundColor: NON_BILLABLE_COLOR }} />
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                            <span>
                              <span style={{ color: BILLABLE_COLOR }}>●</span> {fmtHours(w.billableHours)} billable
                            </span>
                            <span>
                              <span style={{ color: NON_BILLABLE_COLOR }}>●</span> {fmtHours(w.nonBillableHours)} non-billable
                            </span>
                          </div>
                        </div>
                        <span className="text-gray-400 text-xs shrink-0">{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          {w.byType.length === 0 ? (
                            <p className="text-xs text-gray-400">No billable log types recorded.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {w.byType.map((t) => {
                                const pct = (t.hours / maxTypeHours) * 100;
                                return (
                                  <div key={t.slug} className="flex items-center gap-2 text-xs">
                                    <span className="w-28 shrink-0 truncate text-gray-600">{t.typeName}</span>
                                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: NAVY }} />
                                    </div>
                                    <span className="w-12 shrink-0 text-right text-gray-500">{fmtHours(t.hours)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
