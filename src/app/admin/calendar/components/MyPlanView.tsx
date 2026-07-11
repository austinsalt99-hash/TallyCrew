"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_TYPES, EventType, PlanEvent } from "../constants/eventTypes";
import PlanEventModal from "./PlanEventModal";

// ── Types ──────────────────────────────────────────────────────────────────

interface CrewJob {
  id: string;
  date: string;
  title: string;
  assigned_to: string;
  start_time: string;
  end_time: string;
  client: string;
  is_verified: boolean;
}

type PlanView = "day" | "week";

// ── Constants ─────────────────────────────────────────────────────────────

const START_HOUR = 6;
const END_HOUR = 20;
const HOUR_HEIGHT = 60;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const h = START_HOUR + i;
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
});
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

const EMPTY_FORM = {
  title: "",
  event_type: "task" as EventType,
  date: "",
  start_time: "",
  end_time: "",
  description: "",
  location: "",
  attendees: "",
  is_done: false,
};

// ── Utilities ─────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function getWeekDates(dayOffset: number): Date[] {
  const base = getDayDate(dayOffset);
  const dow = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDecimalHour(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Union type for time-grid layout — plan events and crew jobs share one collision pass
type GridItem =
  | { kind: "plan"; ev: PlanEvent; id: string; start_time: string; end_time: string }
  | { kind: "crew"; job: CrewJob; id: string; start_time: string; end_time: string };

function layoutGridItems(items: GridItem[]): { item: GridItem; col: number; totalCols: number }[] {
  const sorted = [...items].sort((a, b) => toDecimalHour(a.start_time) - toDecimalHour(b.start_time));
  const cols = new Array(sorted.length).fill(0);
  for (let i = 0; i < sorted.length; i++) {
    const s = toDecimalHour(sorted[i].start_time);
    const e = sorted[i].end_time ? toDecimalHour(sorted[i].end_time) : s + 1;
    const taken = new Set<number>();
    for (let j = 0; j < i; j++) {
      const sj = toDecimalHour(sorted[j].start_time);
      const ej = sorted[j].end_time ? toDecimalHour(sorted[j].end_time) : sj + 1;
      if (s < ej && e > sj) taken.add(cols[j]);
    }
    let c = 0;
    while (taken.has(c)) c++;
    cols[i] = c;
  }
  return sorted.map((item, i) => {
    const s = toDecimalHour(item.start_time);
    const e = item.end_time ? toDecimalHour(item.end_time) : s + 1;
    let maxCol = cols[i];
    for (let j = 0; j < sorted.length; j++) {
      const sj = toDecimalHour(sorted[j].start_time);
      const ej = sorted[j].end_time ? toDecimalHour(sorted[j].end_time) : sj + 1;
      if (s < ej && e > sj) maxCol = Math.max(maxCol, cols[j]);
    }
    return { item, col: cols[i], totalCols: maxCol + 1 };
  });
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MyPlanView() {
  const [planView, setPlanView] = useState<PlanView>("day");
  const [dayOffset, setDayOffset] = useState(0);
  const [planEvents, setPlanEvents] = useState<PlanEvent[]>([]);
  const [crewJobs, setCrewJobs] = useState<CrewJob[]>([]);
  const [myName, setMyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  const today = getDayDate(0);
  const todayStr = fmt(today);
  const currentDay = getDayDate(dayOffset);
  const currentDayStr = fmt(currentDay);
  const weekDates = getWeekDates(dayOffset);
  const weekFrom = fmt(weekDates[0]);
  const weekTo = fmt(weekDates[6]);

  const fetchFrom = planView === "day" ? currentDayStr : weekFrom;
  const fetchTo = planView === "day" ? currentDayStr : weekTo;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/plan-events?from=${fetchFrom}&to=${fetchTo}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("api_error"); return r.json(); })
      .then((data) => { setPlanEvents(Array.isArray(data) ? data : []); setLoading(false); setApiError(false); })
      .catch(() => { setApiError(true); setLoading(false); });
  }, [fetchFrom, fetchTo]);

  useEffect(() => {
    fetch(`/api/events?from=${fetchFrom}&to=${fetchTo}`)
      .then((r) => r.json())
      .then((data) => setCrewJobs(Array.isArray(data) ? data : []));
  }, [fetchFrom, fetchTo]);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (data?.full_name) setMyName(data.full_name); });
  }, []);

  function openNew(date?: string, prefillType?: EventType, prefillTime?: string) {
    setForm({ ...EMPTY_FORM, date: date ?? currentDayStr, event_type: prefillType ?? "task", start_time: prefillTime ?? "" });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(ev: PlanEvent) {
    setForm({
      title: ev.title,
      event_type: ev.event_type,
      date: ev.date,
      start_time: ev.start_time ?? "",
      end_time: ev.end_time ?? "",
      description: ev.description ?? "",
      location: ev.location ?? "",
      attendees: ev.attendees ?? "",
      is_done: ev.is_done,
    });
    setEditId(ev.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch("/api/admin/plan-events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setPlanEvents((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleToggleDone(ev: PlanEvent) {
    const updated = { ...ev, is_done: !ev.is_done };
    setPlanEvents((prev) => prev.map((e) => e.id === ev.id ? updated : e));
    await fetch("/api/admin/plan-events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: ev.id, is_done: updated.is_done }),
    });
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setQuickAdding(true);
    const res = await fetch("/api/admin/plan-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: quickTitle.trim(), event_type: "task", date: currentDayStr, is_done: false }),
    });
    const saved = await res.json();
    setPlanEvents((prev) => [...prev, saved]);
    setQuickTitle("");
    setQuickAdding(false);
    quickInputRef.current?.focus();
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string, prefillType: EventType = "meeting") {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const decimalHour = relY / HOUR_HEIGHT + START_HOUR;
    const hour = Math.floor(decimalHour);
    const rawMin = Math.round(((decimalHour - hour) * 60) / 15) * 15;
    const h = rawMin >= 60 ? hour + 1 : hour;
    const m = rawMin >= 60 ? 0 : rawMin;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    openNew(dateStr, prefillType, time);
  }

  const todayEvents = planEvents.filter((e) => e.date === currentDayStr);
  const timedEvents = todayEvents.filter((e) => e.start_time);
  const allDayEvents = todayEvents.filter((e) => !e.start_time);
  const pendingTasks = allDayEvents.filter((e) => !e.is_done);
  const doneTasks = allDayEvents.filter((e) => e.is_done);

  function isMyJob(job: CrewJob): boolean {
    if (!myName || !job.assigned_to) return false;
    return job.assigned_to.toLowerCase().includes(myName.toLowerCase());
  }

  const todayCrewJobs = crewJobs.filter((j) => j.date === currentDayStr);
  const myTimedCrewJobsToday = todayCrewJobs.filter((j) => j.start_time && isMyJob(j));

  const navLabel = planView === "day"
    ? dayOffset === 0 ? "Today" : dayOffset === -1 ? "Yesterday" : dayOffset === 1 ? "Tomorrow"
    : currentDay.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[0].getFullYear()}`;

  function goBack() {
    if (planView === "day") setDayOffset((o) => o - 1);
    else setDayOffset((o) => o - 7);
  }
  function goForward() {
    if (planView === "day") setDayOffset((o) => o + 1);
    else setDayOffset((o) => o + 7);
  }

  if (apiError) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-4 text-center">
        <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Database migration required</p>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">Run this SQL in your Supabase SQL Editor to enable My Plan.</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-left max-w-lg mx-auto overflow-x-auto">
          <pre className="text-xs text-green-400 whitespace-pre">{`CREATE TABLE admin_plan_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT DEFAULT 'task'
    CHECK (event_type IN (
      'meeting','site-visit','reminder','task','note'
    )),
  date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  description TEXT,
  location TEXT,
  attendees TEXT,
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_plan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage own plan events"
  ON admin_plan_events
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());`}</pre>
        </div>
        <p className="text-xs text-gray-400">After running the SQL, refresh this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl">‹</button>
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{navLabel}</h2>
            {planView === "day" && dayOffset === 0 && (
              <p className="text-xs text-gray-400 leading-tight">{formatFullDate(currentDay)}</p>
            )}
          </div>
          <button onClick={goForward} className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl">›</button>
          {dayOffset !== 0 && (
            <button onClick={() => setDayOffset(0)} className="text-sm font-semibold text-navy-600 underline">Today</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(["day", "week"] as PlanView[]).map((v) => (
              <button key={v} onClick={() => setPlanView(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${planView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {v === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
          <button
            onClick={() => openNew()}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-2 rounded-xl text-sm flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Add
          </button>
        </div>
      </div>

      {/* ── Quick-add task bar ── */}
      <form onSubmit={handleQuickAdd} className="flex gap-2">
        <input
          ref={quickInputRef}
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Quick-add a task, note, or reminder for today… (press Enter)"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
        />
        <button
          type="submit"
          disabled={!quickTitle.trim() || quickAdding}
          className="px-3 py-2.5 bg-violet-100 hover:bg-violet-200 text-violet-700 font-semibold text-sm rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {quickAdding ? "Adding…" : "Add Task"}
        </button>
      </form>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Loading your plan…</p>
        </div>
      ) : planView === "day" ? (
        /* ── DAY VIEW ── */
        <div className="flex flex-col md:flex-row gap-3 md:items-start">

          {/* Left: schedule + all-day items */}
          <div className="flex-1 space-y-3 min-w-0">

            {/* All-day items (tasks / reminders / notes) */}
            {(allDayEvents.length > 0 || pendingTasks.length === 0) && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Tasks & Reminders
                    {pendingTasks.length > 0 && <span className="ml-1.5 text-violet-600">{pendingTasks.length} pending</span>}
                  </p>
                  <button onClick={() => openNew(currentDayStr, "task")} className="text-xs font-semibold text-violet-600 hover:text-violet-800">+ Add</button>
                </div>
                {allDayEvents.length === 0 ? (
                  <div className="px-4 py-4 text-center">
                    <p className="text-xs text-gray-400">Nothing here — use the quick-add bar above</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {[...pendingTasks, ...doneTasks].map((ev) => {
                      const cfg = EVENT_TYPES[ev.event_type] ?? EVENT_TYPES.task;
                      return (
                        <div key={ev.id} className={`flex items-start gap-3 px-4 py-3 group transition-colors ${ev.is_done ? "opacity-50" : "hover:bg-gray-50"}`}>
                          <button
                            onClick={() => handleToggleDone(ev)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                              ev.is_done ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"
                            }`}
                          >
                            {ev.is_done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${ev.is_done ? "line-through text-gray-400" : "text-gray-900"}`}>{ev.title}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            </div>
                            {ev.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(ev)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M16 2l4 4-8 8H8v-4l8-8z"/></svg>
                            </button>
                            <button onClick={() => handleDelete(ev.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Time grid */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Schedule</p>
                <div className="flex items-center gap-2">
                  {(["meeting", "site-visit"] as EventType[]).map((t) => {
                    const cfg = EVENT_TYPES[t];
                    return (
                      <button key={t} onClick={() => openNew(currentDayStr, t)}
                        className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        + {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
                <div className="flex" style={{ height: TOTAL_HEIGHT }}>
                  {/* Hour labels */}
                  <div className="relative flex-shrink-0" style={{ width: 52 }}>
                    {HOUR_LABELS.map((label, i) => (
                      <div key={i} className="absolute right-0 pr-2 flex items-start" style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                        <span className="text-xs text-gray-400 mt-1 leading-none">{label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Grid */}
                  <div
                    className="flex-1 relative border-l border-gray-100 cursor-crosshair"
                    style={{ height: TOTAL_HEIGHT }}
                    onClick={(e) => handleGridClick(e, currentDayStr)}
                  >
                    {HOUR_LABELS.map((_, i) => (
                      <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * HOUR_HEIGHT }} />
                    ))}
                    {timedEvents.length === 0 && myTimedCrewJobsToday.length === 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                        <p className="text-xs text-gray-300 font-medium">Click to add a meeting or site visit</p>
                      </div>
                    )}
                    {layoutGridItems([
                      ...timedEvents.map((ev): GridItem => ({ kind: "plan", ev, id: ev.id, start_time: ev.start_time, end_time: ev.end_time })),
                      ...myTimedCrewJobsToday.map((job): GridItem => ({ kind: "crew", job, id: job.id, start_time: job.start_time, end_time: job.end_time })),
                    ]).map(({ item, col, totalCols }) => {
                      const startH = toDecimalHour(item.start_time);
                      const endH = item.end_time ? toDecimalHour(item.end_time) : startH + 1;
                      const clampedStart = Math.max(startH, START_HOUR);
                      const clampedEnd = Math.min(endH, END_HOUR);
                      if (clampedEnd <= clampedStart) return null;
                      const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
                      const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 4, 24);
                      const posStyle = {
                        top: top + 2, height,
                        left: `calc(${(col / totalCols) * 100}% + 2px)`,
                        width: `calc(${(1 / totalCols) * 100}% - 4px)`,
                      };

                      if (item.kind === "plan") {
                        const ev = item.ev;
                        const cfg = EVENT_TYPES[ev.event_type] ?? EVENT_TYPES.meeting;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                            className="absolute rounded-xl px-2 py-1.5 overflow-hidden z-10 cursor-pointer hover:brightness-95 transition-all border-l-4"
                            style={{ ...posStyle, backgroundColor: cfg.bg, borderLeftColor: cfg.color }}
                          >
                            <p className="text-xs font-bold leading-tight truncate" style={{ color: cfg.color }}>{ev.title}</p>
                            {height > 36 && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: cfg.color, opacity: 0.7 }}>
                                {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                              </p>
                            )}
                            {height > 52 && ev.location && (
                              <p className="text-[10px] truncate" style={{ color: cfg.color, opacity: 0.6 }}>📍 {ev.location}</p>
                            )}
                            {height > 68 && ev.attendees && (
                              <p className="text-[10px] truncate" style={{ color: cfg.color, opacity: 0.6 }}>👥 {ev.attendees}</p>
                            )}
                          </div>
                        );
                      }

                      // Crew job block — read-only, navy/blue
                      const job = item.job;
                      return (
                        <div
                          key={job.id}
                          className="absolute rounded-xl px-2 py-1.5 overflow-hidden z-10 border-l-4"
                          style={{ ...posStyle, backgroundColor: "#dbeafe", borderLeftColor: "#1d4ed8" }}
                          title="Crew job assigned to you — edit from Crew Board"
                        >
                          <div className="flex items-start gap-1">
                            <p className="text-xs font-bold leading-tight truncate flex-1 text-blue-800">{job.title}</p>
                            <span className="text-[8px] font-bold bg-blue-200 text-blue-700 px-1 rounded flex-shrink-0 leading-none mt-0.5">Crew</span>
                          </div>
                          {height > 36 && (
                            <p className="text-xs mt-0.5 truncate text-blue-600" style={{ opacity: 0.8 }}>
                              {formatTime(job.start_time)}{job.end_time ? ` – ${formatTime(job.end_time)}` : ""}
                            </p>
                          )}
                          {height > 52 && job.client && (
                            <p className="text-[10px] truncate text-blue-500" style={{ opacity: 0.7 }}>{job.client}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Today's Crew */}
          <div className="md:w-64 flex-shrink-0 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {dayOffset === 0 ? "Crew Today" : "Crew That Day"}
                </p>
                {todayCrewJobs.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{todayCrewJobs.length} job{todayCrewJobs.length !== 1 ? "s" : ""} scheduled</p>
                )}
              </div>
              {todayCrewJobs.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-gray-400">No crew jobs scheduled</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {todayCrewJobs
                    .sort((a, b) => {
                      if (!a.start_time) return 1;
                      if (!b.start_time) return -1;
                      return toDecimalHour(a.start_time) - toDecimalHour(b.start_time);
                    })
                    .map((job) => {
                      const mine = isMyJob(job);
                      return (
                        <div key={job.id} className={`px-4 py-2.5 ${mine ? "bg-blue-50/60" : ""}`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${job.is_verified === false ? "bg-gray-300" : mine ? "bg-blue-500" : "bg-blue-400"}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-semibold text-gray-800 truncate">{job.title}</p>
                                {mine && <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded flex-shrink-0 leading-none">You</span>}
                              </div>
                              {job.start_time && (
                                <p className="text-[10px] text-gray-400">{formatTime(job.start_time)}{job.end_time ? ` – ${formatTime(job.end_time)}` : ""}</p>
                              )}
                              {job.assigned_to && (
                                <p className="text-[10px] text-gray-400 truncate">{job.assigned_to}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Event Types</p>
              {(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => openNew(currentDayStr, key)}
                  className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-lg px-1 py-1 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs text-gray-600">{cfg.label}</span>
                  <span className="ml-auto text-gray-200 text-sm">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── WEEK VIEW ── */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {weekDates.map((date, i) => {
                    const dateStr = fmt(date);
                    const isToday = dateStr === todayStr;
                    return (
                      <th
                        key={dateStr}
                        className={`px-2 py-3 text-center border-r border-gray-100 last:border-r-0 ${isToday ? "bg-violet-50" : ""}`}
                      >
                        <div className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? "text-violet-500" : "text-gray-400"}`}>{DAY_NAMES[i]}</div>
                        <button
                          onClick={() => { setPlanView("day"); setDayOffset(Math.round((date.getTime() - today.getTime()) / 86400000)); }}
                          className={`text-xl font-extrabold leading-tight hover:underline ${isToday ? "text-violet-600" : "text-gray-700"}`}
                        >
                          {date.getDate()}
                        </button>
                        <div className={`text-[10px] ${isToday ? "text-violet-400" : "text-gray-400"}`}>{MONTHS[date.getMonth()]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {weekDates.map((date) => {
                    const dateStr = fmt(date);
                    const isToday = dateStr === todayStr;
                    const dayEvs = planEvents.filter((e) => e.date === dateStr);
                    const myDayCrewJobs = crewJobs.filter((j) => j.date === dateStr && isMyJob(j));
                    const sorted = [...dayEvs].sort((a, b) => {
                      if (a.start_time && b.start_time) return toDecimalHour(a.start_time) - toDecimalHour(b.start_time);
                      if (a.start_time) return -1;
                      if (b.start_time) return 1;
                      return 0;
                    });
                    const hasAnything = sorted.length > 0 || myDayCrewJobs.length > 0;
                    return (
                      <td
                        key={dateStr}
                        className={`border-r border-gray-100 last:border-r-0 p-1.5 align-top min-h-[120px] cursor-pointer ${isToday ? "bg-violet-50/30" : "hover:bg-gray-50"}`}
                        style={{ minHeight: 120, verticalAlign: "top" }}
                        onClick={() => { if (!hasAnything) openNew(dateStr); }}
                      >
                        <div className="space-y-1">
                          {!hasAnything ? (
                            <div className="h-20 flex items-center justify-center">
                              <span className="text-gray-200 text-lg">+</span>
                            </div>
                          ) : (
                            <>
                              {sorted.map((ev) => {
                                const cfg = EVENT_TYPES[ev.event_type] ?? EVENT_TYPES.task;
                                return (
                                  <div
                                    key={ev.id}
                                    onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                                    className={`rounded-lg px-2 py-1 cursor-pointer hover:brightness-95 transition-all ${ev.is_done ? "opacity-50" : ""}`}
                                    style={{ backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}
                                  >
                                    <p className="text-[10px] font-bold truncate" style={{ color: cfg.color }}>{ev.title}</p>
                                    {ev.start_time && <p className="text-[9px]" style={{ color: cfg.color, opacity: 0.7 }}>{formatTime(ev.start_time)}</p>}
                                  </div>
                                );
                              })}
                              {myDayCrewJobs.map((job) => (
                                <div
                                  key={job.id}
                                  className="rounded-lg px-2 py-1"
                                  style={{ backgroundColor: "#dbeafe", borderLeft: "3px solid #1d4ed8" }}
                                  title="Crew job assigned to you"
                                >
                                  <div className="flex items-center gap-1">
                                    <p className="text-[10px] font-bold truncate flex-1 text-blue-800">{job.title}</p>
                                    <span className="text-[8px] font-bold text-blue-600 flex-shrink-0">Crew</span>
                                  </div>
                                  {job.start_time && <p className="text-[9px] text-blue-500">{formatTime(job.start_time)}</p>}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
            <span className="text-xs text-gray-400">Click a date number to open day view · Click any event to edit</span>
          </div>
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      <PlanEventModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={(saved) => {
          if (editId) {
            setPlanEvents((prev) => prev.map((e) => e.id === editId ? saved : e));
          } else {
            setPlanEvents((prev) => [...prev, saved]);
          }
          setShowForm(false);
          setEditId(null);
        }}
        initialType={form.event_type}
        initialDate={form.date}
        editEvent={editId ? planEvents.find((e) => e.id === editId) ?? null : null}
      />
    </div>
  );
}
