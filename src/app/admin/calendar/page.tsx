"use client";

import { useEffect, useState } from "react";

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

const EMPTY_FORM = {
  date: "",
  title: "",
  client: "",
  location: "",
  description: "",
  start_time: "",
  end_time: "",
  assigned_to: "",
};

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

export default function AdminCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const from = fmt(weekDates[0]);
  const to = fmt(weekDates[6]);
  const todayStr = fmt(new Date());
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const token = typeof window !== "undefined" ? localStorage.getItem("cew-admin-token") ?? "" : "";

  useEffect(() => {
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []));
  }, [from, to]);

  function openNew(date = "", startTime = "") {
    setForm({ ...EMPTY_FORM, date, start_time: startTime });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(ev: JobEvent) {
    setForm({
      date: ev.date,
      title: ev.title,
      client: ev.client ?? "",
      location: ev.location ?? "",
      description: ev.description ?? "",
      start_time: ev.start_time ?? "",
      end_time: ev.end_time ?? "",
      assigned_to: ev.assigned_to ?? "",
    });
    setEditId(ev.id);
    setShowForm(true);
  }

  function handleGridClick(dateStr: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const decimalHour = relY / HOUR_HEIGHT + START_HOUR;
    const hour = Math.floor(decimalHour);
    const rawMin = Math.round(((decimalHour - hour) * 60) / 15) * 15;
    const h = rawMin >= 60 ? hour + 1 : hour;
    const m = rawMin >= 60 ? 0 : rawMin;
    openNew(dateStr, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  async function handleSave() {
    if (!form.title || !form.date) return;
    setSaving(true);
    const method = editId ? "PUT" : "POST";
    const body = editId ? { id: editId, ...form } : form;
    await fetch("/api/events", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const res = await fetch(`/api/events?from=${from}&to=${to}`);
    setEvents(await res.json());
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job?")) return;
    await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const monthLabel = `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >‹</button>
          <h1 className="text-xl font-bold text-gray-900">{monthLabel}</h1>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >›</button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-sm font-semibold text-blue-600 underline">
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => openNew()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + Add Job
        </button>
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
                  <div key={dateStr} className={`flex-1 py-3 text-center border-l border-gray-100 ${isToday ? "bg-blue-50" : ""}`}>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? "text-blue-500" : "text-gray-400"}`}>
                      {DAY_NAMES[i]}
                    </div>
                    <div className={`text-2xl font-extrabold leading-tight mt-0.5 ${isToday ? "text-blue-600" : "text-gray-800"}`}>
                      {date.getDate()}
                    </div>
                    <div className={`text-xs mt-0.5 ${isToday ? "text-blue-400" : "text-gray-400"}`}>
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
                      className={`flex-1 relative border-l border-gray-100 cursor-crosshair ${isToday ? "bg-blue-50/20" : ""}`}
                      style={{ height: totalHeight }}
                      onClick={(e) => handleGridClick(dateStr, e)}
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
                            className="absolute left-1 right-1 rounded-xl px-2 py-1.5 overflow-hidden z-10 group cursor-pointer hover:brightness-90"
                            style={{ top: top + 2, height, backgroundColor: "#3b82f6" }}
                            onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-white text-xs font-bold leading-tight truncate">{ev.title}</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }}
                                className="text-white/60 hover:text-white text-base leading-none opacity-0 group-hover:opacity-100 flex-shrink-0 font-bold"
                              >×</button>
                            </div>
                            {ev.client && height > 38 && (
                              <p className="text-white/80 text-xs truncate">{ev.client}</p>
                            )}
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

          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Job" : "Add Job"}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Job title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client</label>
                <input type="text" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start time</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End time</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Assigned to</label>
                <input type="text" placeholder="Employee name(s)" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.date}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-2.5 text-sm font-bold">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
