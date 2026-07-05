"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import DesktopHeader from "@/components/DesktopHeader";

interface JobEvent {
  id: string;
  date: string;
  title: string;
  client: string;
  location: string;
  description: string;
  start_time: string;
  end_time: string;
  assigned_to: string;
}

type CalView = "month" | "week" | "day";

const START_HOUR = 6;
const END_HOUR = 19;
const HOUR_HEIGHT = 64;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const h = START_HOUR + i;
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
});

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getDayDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function getMonthDays(offset: number): Date[] {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const endPad = (7 - lastOfMonth.getDay()) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startPad);
  const totalDays = startPad + lastOfMonth.getDate() + endPad;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function dayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

function toDecimalHour(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function layoutEvents(evs: JobEvent[]): { ev: JobEvent; col: number; totalCols: number }[] {
  const sorted = [...evs].sort((a, b) => toDecimalHour(a.start_time) - toDecimalHour(b.start_time));
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
  return sorted.map((ev, i) => {
    const s = toDecimalHour(ev.start_time);
    const e = ev.end_time ? toDecimalHour(ev.end_time) : s + 1;
    let maxCol = cols[i];
    for (let j = 0; j < sorted.length; j++) {
      const sj = toDecimalHour(sorted[j].start_time);
      const ej = sorted[j].end_time ? toDecimalHour(sorted[j].end_time) : sj + 1;
      if (s < ej && e > sj) maxCol = Math.max(maxCol, cols[j]);
    }
    return { ev, col: cols[i], totalCols: maxCol + 1 };
  });
}

const ORANGE = "#F4A823";

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [calView, setCalView] = useState<CalView>("week");
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<JobEvent | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const dayDate = getDayDate(dayOffset);
  const monthDays = getMonthDays(monthOffset);
  const todayStr = fmt(new Date());
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  let fetchFrom: string, fetchTo: string;
  if (calView === "week") {
    fetchFrom = fmt(weekDates[0]); fetchTo = fmt(weekDates[6]);
  } else if (calView === "day") {
    fetchFrom = fetchTo = fmt(dayDate);
  } else {
    fetchFrom = fmt(monthDays[0]);
    fetchTo = fmt(monthDays[monthDays.length - 1]);
  }

  function goBack() {
    if (calView === "week") setWeekOffset((o) => o - 1);
    else if (calView === "day") setDayOffset((o) => o - 1);
    else setMonthOffset((o) => o - 1);
  }

  function goForward() {
    if (calView === "week") setWeekOffset((o) => o + 1);
    else if (calView === "day") setDayOffset((o) => o + 1);
    else setMonthOffset((o) => o + 1);
  }

  function goToday() {
    setWeekOffset(0); setDayOffset(0); setMonthOffset(0);
  }

  const showTodayBtn = weekOffset !== 0 || dayOffset !== 0 || monthOffset !== 0;

  function getNavLabel(): string {
    if (calView === "month") {
      const now = new Date();
      const t = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      return `${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
    }
    if (calView === "day") {
      if (dayOffset === 0) return "Today";
      if (dayOffset === -1) return "Yesterday";
      if (dayOffset === 1) return "Tomorrow";
      return dayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    return `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`;
  }

  useEffect(() => {
    fetch(`/api/events?from=${fetchFrom}&to=${fetchTo}`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []));
  }, [fetchFrom, fetchTo]);

  function renderTimeGrid(dates: Date[]) {
    return (
      <div className={`overflow-y-auto ${selectedEvent ? "max-h-60 md:max-h-[520px]" : "md:max-h-[520px]"}`}>
        <div className="flex" style={{ height: totalHeight }}>
          <div className="relative flex-shrink-0" style={{ width: 56 }}>
            {HOUR_LABELS.map((label, i) => (
              <div key={i} className="absolute right-0 pr-2 flex items-start" style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                <span className="text-xs text-gray-400 mt-1 leading-none">{label}</span>
              </div>
            ))}
          </div>
          {dates.map((date) => {
            const dateStr = fmt(date);
            const dayEvents = events.filter((e) => e.date === dateStr && e.start_time);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={`flex-1 relative border-l border-gray-100 ${isToday ? "bg-green-50/30" : ""}`}
                style={{ height: totalHeight }}
              >
                {HOUR_LABELS.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {layoutEvents(dayEvents).map(({ ev, col, totalCols }) => {
                  const startH = toDecimalHour(ev.start_time);
                  const endH = ev.end_time ? toDecimalHour(ev.end_time) : startH + 1;
                  const clampedStart = Math.max(startH, START_HOUR);
                  const clampedEnd = Math.min(endH, END_HOUR);
                  if (clampedEnd <= clampedStart) return null;
                  const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
                  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 4, 22);
                  const isSelected = selectedEvent?.id === ev.id;
                  const leftPct = (col / totalCols) * 100;
                  const widthPct = (1 / totalCols) * 100;
                  return (
                    <div
                      key={ev.id}
                      className={`absolute rounded-xl px-2 py-1.5 overflow-hidden z-10 cursor-pointer transition-all ${isSelected ? "ring-2 ring-white ring-offset-1 brightness-90" : "hover:brightness-90"}`}
                      style={{
                        top: top + 2, height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: ORANGE,
                      }}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <p className="text-white text-xs font-bold leading-tight truncate">{ev.title}</p>
                      {ev.client && height > 38 && <p className="text-white/80 text-xs truncate">{ev.client}</p>}
                      {height > 54 && ev.start_time && (
                        <p className="text-white/70 text-xs">
                          {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopHeader />
      <main className="max-w-5xl mx-auto px-4 pt-6" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>

        {/* Top bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
              >‹</button>
              <h1 className="text-xl font-bold text-gray-900">{getNavLabel()}</h1>
              <button
                onClick={goForward}
                className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
              >›</button>
              {showTodayBtn && (
                <button onClick={goToday} className="text-sm font-semibold underline" style={{ color: ORANGE }}>
                  Today
                </button>
              )}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(["month", "week", "day"] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => setCalView(v)}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors"
                style={calView === v ? { backgroundColor: "white", color: "#111827", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" } : { color: "#6b7280" }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar + Details split layout */}
        <div className={`flex flex-col ${selectedEvent ? "md:flex-row md:gap-4 md:items-start" : ""}`}>

          <div className={selectedEvent ? "md:w-1/2" : ""}>

            {/* MONTH VIEW */}
            {calView === "month" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {(() => {
                    const displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1).getMonth();
                    return monthDays.map((date, idx) => {
                      const dateStr = fmt(date);
                      const isCurrentMonth = date.getMonth() === displayedMonth;
                      const isToday = dateStr === todayStr;
                      const dayEvents = events.filter((e) => e.date === dateStr);
                      return (
                        <div
                          key={dateStr}
                          onClick={() => { setDayOffset(dayDiff(date, new Date())); setCalView("day"); }}
                          className={`min-h-[72px] p-1 border-t border-gray-100 cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors ${!isCurrentMonth ? "bg-gray-50/60" : ""} ${idx % 7 !== 6 ? "border-r border-gray-100" : ""}`}
                        >
                          <div
                            className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1"
                            style={isToday ? { backgroundColor: ORANGE, color: "white" } : { color: isCurrentMonth ? "#1f2937" : "#d1d5db" }}
                          >
                            {date.getDate()}
                          </div>
                          {dayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                              className="text-[9px] leading-tight text-white px-1 py-0.5 rounded mb-0.5 truncate"
                              style={{ backgroundColor: ORANGE }}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[9px] text-gray-400 px-0.5">+{dayEvents.length - 2}</div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calView === "week" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 640 }}>
                    <div className="flex border-b border-gray-200" style={{ paddingLeft: 56 }}>
                      {weekDates.map((date, i) => {
                        const dateStr = fmt(date);
                        const isToday = dateStr === todayStr;
                        return (
                          <div key={dateStr} className={`flex-1 py-3 text-center border-l border-gray-100 ${isToday ? "bg-green-50" : ""}`}>
                            <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? "text-green-500" : "text-gray-400"}`}>
                              {DAY_NAMES[i]}
                            </div>
                            <div className={`text-2xl font-extrabold leading-tight mt-0.5 ${isToday ? "text-green-600" : "text-gray-800"}`}>
                              {date.getDate()}
                            </div>
                            <div className={`text-xs mt-0.5 ${isToday ? "text-green-400" : "text-gray-400"}`}>
                              {MONTHS[date.getMonth()]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {renderTimeGrid(weekDates)}
                  </div>
                </div>
              </div>
            )}

            {/* DAY VIEW */}
            {calView === "day" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {(() => {
                  const dateStr = fmt(dayDate);
                  const isToday = dateStr === todayStr;
                  return (
                    <>
                      <div className={`py-3 text-center border-b border-gray-200 ${isToday ? "bg-green-50" : ""}`}>
                        <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? "text-green-500" : "text-gray-400"}`}>
                          {dayDate.toLocaleDateString("en-US", { weekday: "long" })}
                        </div>
                        <div className={`text-2xl font-extrabold leading-tight mt-0.5 ${isToday ? "text-green-600" : "text-gray-800"}`}>
                          {dayDate.getDate()}
                        </div>
                        <div className={`text-xs mt-0.5 ${isToday ? "text-green-400" : "text-gray-400"}`}>
                          {MONTHS[dayDate.getMonth()]} {dayDate.getFullYear()}
                        </div>
                      </div>
                      {renderTimeGrid([dayDate])}
                    </>
                  );
                })()}
              </div>
            )}

          </div>

          {/* Details panel — read-only for employees */}
          {selectedEvent && (
            <div className="mt-4 md:mt-0 md:w-1/2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: ORANGE }}>Job Details</p>
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{selectedEvent.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex-shrink-0 mt-0.5"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {selectedEvent.date && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Date</p>
                    <p className="text-sm text-gray-800">{formatDate(selectedEvent.date)}</p>
                  </div>
                )}
                {(selectedEvent.start_time || selectedEvent.end_time) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Time</p>
                    <p className="text-sm text-gray-800">
                      {formatTime(selectedEvent.start_time)}{selectedEvent.end_time ? ` – ${formatTime(selectedEvent.end_time)}` : ""}
                    </p>
                  </div>
                )}
                {selectedEvent.client && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Client</p>
                    <p className="text-sm text-gray-800">{selectedEvent.client}</p>
                  </div>
                )}
                {selectedEvent.location && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm text-gray-800">{selectedEvent.location}</p>
                  </div>
                )}
                {selectedEvent.assigned_to && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Assigned to</p>
                    <p className="text-sm text-gray-800">{selectedEvent.assigned_to}</p>
                  </div>
                )}
                {selectedEvent.description && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
      <BottomNav />
    </div>
  );
}
