"use client";

import { useEffect, useState } from "react";
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

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function TodaySchedule() {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    fetch(`/api/events?from=${today}&to=${today}`)
      .then((r) => r.json())
      .then((data) => { setEvents(Array.isArray(data) ? data : []); setLoading(false); });
  }, [today]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Today</p>
          <h2 className="text-lg font-bold text-gray-900">{dayLabel}</h2>
        </div>
        <Link href="/schedule" className="text-sm font-semibold hover:underline" style={{ color: "#F4A823" }}>
          Full week →
        </Link>
      </div>

      {loading ? (
        <p className="px-5 py-4 text-sm text-gray-400">Loading...</p>
      ) : events.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">No jobs scheduled for today</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {events.map((ev) => (
            <div key={ev.id} className="px-5 py-3.5 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#F4A823" }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{ev.title}</p>
                {ev.client && <p className="text-sm text-gray-500">{ev.client}</p>}
                {ev.location && (
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z"/><circle cx="8" cy="6" r="1.5"/></svg>
                    {ev.location}
                  </p>
                )}
                {ev.assigned_to && (
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="8" cy="5.5" r="2.5"/><path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg>
                    {ev.assigned_to}
                  </p>
                )}
                {ev.description && <p className="text-sm text-gray-500 mt-0.5">{ev.description}</p>}
              </div>
              {ev.start_time && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: "#F4A823" }}>{formatTime(ev.start_time)}</p>
                  {ev.end_time && <p className="text-xs text-gray-400">{formatTime(ev.end_time)}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
