"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(t: string) {
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

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const from = fmt(weekDates[0]);
  const to = fmt(weekDates[6]);
  const todayStr = fmt(new Date());
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => { setEvents(Array.isArray(data) ? data : []); setLoading(false); });
  }, [from, to]);

  const monthLabel = `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Image src="/logo.webp" alt="Cumberland Earthworks" width={160} height={45} priority />
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-900">
              ← Log Hours
            </Link>
            <Link href="/admin" className="text-sm font-semibold text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
              Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Week navigation */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >‹</button>
          <span className="text-xl font-bold text-gray-900">{monthLabel}</span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >›</button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-sm font-semibold underline" style={{ color: "#5DB941" }}>
              This week
            </button>
          )}
        </div>

        {/* Calendar card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 640 }}>

              {/* Day header row */}
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

              {/* Time grid */}
              <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
                <div className="flex" style={{ height: totalHeight }}>

                  {/* Hour label column */}
                  <div className="relative flex-shrink-0" style={{ width: 56 }}>
                    {HOUR_LABELS.map((label, i) => (
                      <div
                        key={i}
                        className="absolute right-0 pr-2 flex items-start"
                        style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      >
                        <span className="text-xs text-gray-400 mt-1 leading-none">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDates.map((date) => {
                    const dateStr = fmt(date);
                    const dayEvents = events.filter((e) => e.date === dateStr && e.start_time);
                    const isToday = dateStr === todayStr;
                    return (
                      <div
                        key={dateStr}
                        className={`flex-1 relative border-l border-gray-100 ${isToday ? "bg-green-50/30" : ""}`}
                        style={{ height: totalHeight }}
                      >
                        {/* Hour grid lines */}
                        {HOUR_LABELS.map((_, i) => (
                          <div
                            key={i}
                            className="absolute left-0 right-0 border-t border-gray-100"
                            style={{ top: i * HOUR_HEIGHT }}
                          />
                        ))}

                        {/* Job event blocks */}
                        {dayEvents.map((ev) => {
                          const startH = toDecimalHour(ev.start_time);
                          const endH = ev.end_time ? toDecimalHour(ev.end_time) : startH + 1;
                          const clampedStart = Math.max(startH, START_HOUR);
                          const clampedEnd = Math.min(endH, END_HOUR);
                          if (clampedEnd <= clampedStart) return null;
                          const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
                          const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 4, 22);
                          return (
                            <div
                              key={ev.id}
                              className="absolute left-1 right-1 rounded-xl px-2 py-1.5 overflow-hidden z-10"
                              style={{ top: top + 2, height, backgroundColor: "#5DB941" }}
                            >
                              <p className="text-white text-xs font-bold leading-tight truncate">{ev.title}</p>
                              {ev.client && height > 38 && (
                                <p className="text-white/80 text-xs leading-tight truncate">{ev.client}</p>
                              )}
                              {height > 54 && ev.start_time && (
                                <p className="text-white/70 text-xs mt-0.5">
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

            </div>
          </div>
        </div>

        {loading && <p className="text-center text-sm text-gray-400 mt-4">Loading schedule...</p>}
      </div>
    </div>
  );
}
