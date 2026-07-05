"use client";

import { useState } from "react";

export interface JobEvent {
  id: string;
  date: string;
  title: string;
  client?: string;
  start_time?: string;
  end_time?: string;
}

interface Props {
  events: JobEvent[];
  baseDate: string;
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (event: JobEvent) => void;
  onClose: () => void;
}

const PICK_START_HOUR = 6;
const PICK_END_HOUR = 19;
const PICK_HOUR_HEIGHT = 40;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekBounds(baseDate: string, offset: number): { from: Date; to: Date } {
  const [y, mo, d] = baseDate.split("-").map(Number);
  const base = new Date(y, mo - 1, d);
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: monday, to: sunday };
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekLabel(from: Date, to: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

function formatDayHeading(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function toDecimalHour(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

// Compact hour label e.g. "7a", "12p", "3p"
function shortHour(h: number): string {
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export default function JobEventPicker({ events, baseDate, weekOffset, onPrev, onNext, onSelect, onClose }: Props) {
  const [view, setView] = useState<"list" | "calendar">("list");

  const { from, to } = getWeekBounds(baseDate, weekOffset);
  const fromISO = toISO(from);
  const toISO_ = toISO(to);

  const weekEvents = events.filter((e) => e.date >= fromISO && e.date <= toISO_);

  // Week days array (Mon → Sun)
  const weekDays: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    weekDays.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  // List view: group by date
  const byDate: Record<string, JobEvent[]> = {};
  for (const e of weekEvents) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }
  const sortedDates = Object.keys(byDate).sort();

  const totalHeight = (PICK_END_HOUR - PICK_START_HOUR) * PICK_HOUR_HEIGHT;
  const hourLabels = Array.from({ length: PICK_END_HOUR - PICK_START_HOUR }, (_, i) => shortHour(PICK_START_HOUR + i));

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, right sidebar on desktop */}
      <div className="
        absolute inset-x-0 bottom-0 h-[62vh] rounded-t-2xl
        md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:h-auto md:w-[400px] md:rounded-none
        bg-white shadow-xl flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-900 flex-1 text-sm">Link to schedule</span>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 font-bold text-lg leading-none">‹</button>
            <span className="text-xs text-gray-500 whitespace-nowrap px-1">{formatWeekLabel(from, to)}</span>
            <button onClick={onNext} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 font-bold text-lg leading-none">›</button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              title="List view"
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm text-navy-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              title="Calendar view"
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${view === "calendar" ? "bg-white shadow-sm text-navy-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
          </button>
        </div>

        {/* Body */}
        {view === "list" ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {sortedDates.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                No events scheduled this week.
              </div>
            ) : (
              sortedDates.map((dateStr) => (
                <div key={dateStr}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {formatDayHeading(dateStr)}
                  </p>
                  <div className="space-y-2">
                    {byDate[dateStr]
                      .slice()
                      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
                      .map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onSelect(event)}
                          className="w-full text-left bg-navy-50 border border-navy-200 rounded-xl px-4 py-3 hover:bg-navy-100 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{event.title}</span>
                            {event.start_time && (
                              <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                                {formatTime(event.start_time)}
                                {event.end_time && ` – ${formatTime(event.end_time)}`}
                              </span>
                            )}
                          </div>
                          {event.client && (
                            <p className="text-xs text-gray-500 mt-0.5">{event.client}</p>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Calendar view */
          <div className="flex-1 overflow-auto">
            <div style={{ minWidth: 520 }}>

              {/* Day header row */}
              <div className="flex sticky top-0 bg-white z-10 border-b border-gray-100" style={{ paddingLeft: 36 }}>
                {weekDays.map((d, i) => (
                  <div key={i} className="flex-1 py-2 text-center border-l border-gray-100 first:border-l-0">
                    <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{DAY_NAMES[i]}</div>
                    <div className="text-sm font-bold text-gray-800 leading-tight">{d.getDate()}</div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div className="flex" style={{ height: totalHeight }}>
                {/* Hour labels */}
                <div className="relative flex-shrink-0" style={{ width: 36 }}>
                  {hourLabels.map((label, i) => (
                    <div
                      key={i}
                      className="absolute right-1 text-gray-400 leading-none"
                      style={{ top: i * PICK_HOUR_HEIGHT + 2, fontSize: 9 }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((date, colIdx) => {
                  const dateStr = toISO(date);
                  const dayEvs = weekEvents.filter((e) => e.date === dateStr && e.start_time);
                  return (
                    <div
                      key={colIdx}
                      className="flex-1 relative border-l border-gray-100"
                      style={{ height: totalHeight }}
                    >
                      {/* Hour grid lines */}
                      {hourLabels.map((_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: i * PICK_HOUR_HEIGHT }}
                        />
                      ))}

                      {/* Event blocks */}
                      {dayEvs.map((ev) => {
                        const startH = toDecimalHour(ev.start_time!);
                        const endH = ev.end_time ? toDecimalHour(ev.end_time) : startH + 1;
                        const clampedStart = Math.max(startH, PICK_START_HOUR);
                        const clampedEnd = Math.min(endH, PICK_END_HOUR);
                        if (clampedEnd <= clampedStart) return null;
                        const top = (clampedStart - PICK_START_HOUR) * PICK_HOUR_HEIGHT;
                        const height = Math.max((clampedEnd - clampedStart) * PICK_HOUR_HEIGHT - 2, 16);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => onSelect(ev)}
                            className="absolute left-0.5 right-0.5 rounded-lg px-1 py-0.5 bg-navy-500 hover:bg-navy-600 overflow-hidden text-left transition-colors"
                            style={{ top: top + 1, height }}
                          >
                            <p className="text-white font-semibold leading-tight truncate" style={{ fontSize: 10 }}>
                              {ev.title}
                            </p>
                            {height > 28 && ev.client && (
                              <p className="text-navy-100 leading-tight truncate" style={{ fontSize: 9 }}>
                                {ev.client}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
