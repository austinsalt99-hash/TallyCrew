"use client";

import { useEffect, useState } from "react";

interface JobEvent {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  assigned_to: string;
  is_verified: boolean;
}

interface Worker {
  id: string;
  full_name: string;
  role: string;
}

interface WeekRange {
  label: string;
  from: string;
  to: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(offset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekRange(mondayOffset: number): WeekRange {
  const monday = getMondayOfWeek(mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const from = fmt(monday);
  const to = fmt(sunday);
  const label = monday.getMonth() === sunday.getMonth()
    ? `${MONTHS[monday.getMonth()]} ${monday.getDate()}–${sunday.getDate()}`
    : `${MONTHS[monday.getMonth()]} ${monday.getDate()} – ${MONTHS[sunday.getMonth()]} ${sunday.getDate()}`;
  return { label, from, to };
}

function toDecimalHour(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function calcHrsDecimal(start?: string, end?: string): number {
  if (!start || !end) return 0;
  return Math.max(toDecimalHour(end) - toDecimalHour(start), 0);
}

function isAssignedTo(ev: JobEvent, name: string): boolean {
  if (!ev.assigned_to) return false;
  return ev.assigned_to.toLowerCase().includes(name.toLowerCase());
}

function fmtHrs(h: number): string {
  if (h <= 0) return "0h";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours}h`;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function utilizationColor(pct: number): { bar: string; text: string } {
  if (pct >= 100) return { bar: "#ef4444", text: "text-red-600" };
  if (pct >= 80) return { bar: "#f59e0b", text: "text-amber-600" };
  return { bar: "#22c55e", text: "text-green-600" };
}

export default function WorkloadView() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStartOffset, setWeekStartOffset] = useState(0);
  const [targetHours, setTargetHours] = useState(40);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("40");

  const NUM_WEEKS = 4;
  const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => getWeekRange(weekStartOffset + i));

  const overallFrom = weeks[0].from;
  const overallTo = weeks[NUM_WEEKS - 1].to;

  useEffect(() => {
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setWorkers(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/events?from=${overallFrom}&to=${overallTo}`)
      .then((r) => r.json())
      .then((data) => { setEvents(Array.isArray(data) ? data : []); setLoading(false); });
  }, [overallFrom, overallTo]);

  const crew = workers.filter((w) => w.role === "worker");

  function getHoursForWorkerWeek(workerName: string, from: string, to: string): number {
    return events
      .filter((ev) => ev.date >= from && ev.date <= to && isAssignedTo(ev, workerName))
      .reduce((sum, ev) => sum + calcHrsDecimal(ev.start_time, ev.end_time), 0);
  }

  function getTotalHoursForWorker(workerName: string): number {
    return weeks.reduce((sum, w) => sum + getHoursForWorkerWeek(workerName, w.from, w.to), 0);
  }

  function saveTarget() {
    const val = parseInt(targetInput);
    if (!isNaN(val) && val > 0 && val <= 168) setTargetHours(val);
    setEditingTarget(false);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-400">Loading workload data…</p>
      </div>
    );
  }

  if (crew.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-400">No crew members found. Add workers in the Workers section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStartOffset((o) => o - 1)}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >‹</button>
          <span className="text-sm font-semibold text-gray-700">{weeks[0].label} – {weeks[NUM_WEEKS - 1].label}</span>
          <button
            onClick={() => setWeekStartOffset((o) => o + 1)}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >›</button>
          {weekStartOffset !== 0 && (
            <button onClick={() => setWeekStartOffset(0)} className="text-sm font-semibold text-navy-600 underline">
              This week
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Target hrs/week:</span>
          {editingTarget ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") setEditingTarget(false); }}
                className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400 text-center"
                autoFocus
              />
              <button onClick={saveTarget} className="text-xs text-navy-600 font-semibold">Set</button>
            </div>
          ) : (
            <button
              onClick={() => { setTargetInput(String(targetHours)); setEditingTarget(true); }}
              className="text-xs font-bold text-navy-600 border border-navy-200 rounded-lg px-2 py-1 hover:bg-navy-50"
            >
              {targetHours}h
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { color: "#22c55e", label: `< 80% (under ${Math.round(targetHours * 0.8)}h)` },
          { color: "#f59e0b", label: `80–99% (${Math.round(targetHours * 0.8)}–${targetHours - 1}h)` },
          { color: "#ef4444", label: `≥ 100% (${targetHours}h+)` },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Workload table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 600 }}>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200" style={{ width: 160 }}>
                  Team Member
                </th>
                {weeks.map((w) => (
                  <th key={w.from} className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {w.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide border-l border-gray-200">
                  4-wk Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {crew.map((worker) => {
                const weekHours = weeks.map((w) => getHoursForWorkerWeek(worker.full_name, w.from, w.to));
                const totalHours = weekHours.reduce((a, b) => a + b, 0);
                return (
                  <tr key={worker.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-r border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {worker.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-800 truncate">{worker.full_name}</span>
                      </div>
                    </td>
                    {weekHours.map((hrs, i) => {
                      const pct = targetHours > 0 ? Math.round((hrs / targetHours) * 100) : 0;
                      const { bar, text } = utilizationColor(pct);
                      return (
                        <td key={i} className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${hrs > 0 ? text : "text-gray-300"}`}>
                                {fmtHrs(hrs)}
                              </span>
                              {hrs > 0 && (
                                <span className={`text-[10px] font-medium ${text}`}>{pct}%</span>
                              )}
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: bar }}
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 border-l border-gray-100 text-right">
                      <span className={`text-sm font-bold ${totalHours > 0 ? "text-gray-800" : "text-gray-300"}`}>
                        {fmtHrs(totalHours)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="px-4 py-2.5 border-r border-gray-200">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Team Total</span>
                </td>
                {weeks.map((w, i) => {
                  const total = crew.reduce((sum, worker) => sum + getHoursForWorkerWeek(worker.full_name, w.from, w.to), 0);
                  return (
                    <td key={i} className="px-3 py-2.5 text-center">
                      <span className="text-xs font-bold text-gray-600">{fmtHrs(total)}</span>
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right border-l border-gray-200">
                  <span className="text-xs font-bold text-gray-600">
                    {fmtHrs(crew.reduce((sum, w) => sum + getTotalHoursForWorker(w.full_name), 0))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Based on scheduled job times. Jobs without start/end times are not counted.
      </p>
    </div>
  );
}
