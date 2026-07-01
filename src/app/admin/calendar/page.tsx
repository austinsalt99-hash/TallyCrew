"use client";

import { useEffect, useRef, useState } from "react";

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
  is_verified: boolean;
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
  is_verified: true as boolean,
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [year, month, day] = d.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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
  const [selectedEvent, setSelectedEvent] = useState<JobEvent | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const weekDates = getWeekDates(weekOffset);
  const from = fmt(weekDates[0]);
  const to = fmt(weekDates[6]);
  const todayStr = fmt(new Date());
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  useEffect(() => {
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []));
  }, [from, to]);

  function openNew(date = "", startTime = "") {
    setForm({ ...EMPTY_FORM, date, start_time: startTime, is_verified: true });
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
      is_verified: ev.is_verified !== false,
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
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvent(null);
  }

  async function handleVerify(id: string) {
    await fetch("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, is_verified: true }),
    });
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, is_verified: true } : e));
    setSelectedEvent((prev) => prev?.id === id ? { ...prev, is_verified: true } : prev);
  }

  function handleVoiceToggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    setTranscript("");
    setListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalTranscript = Array.from(event.results as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(finalTranscript);
    };

    recognition.onend = async () => {
      setListening(false);
      if (!finalTranscript.trim()) {
        setTranscript("");
        return;
      }
      setParsing(true);
      try {
        const res = await fetch("/api/admin/parse-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: finalTranscript }),
        });
        const parsed = await res.json();
        if (parsed.error) throw new Error(parsed.error);
        setForm({
          date: parsed.date ?? "",
          title: parsed.title ?? "",
          client: parsed.client ?? "",
          location: parsed.location ?? "",
          description: parsed.description ?? "",
          start_time: parsed.start_time ?? "",
          end_time: parsed.end_time ?? "",
          assigned_to: parsed.assigned_to ?? "",
          is_verified: false,
        });
        setEditId(null);
        setShowForm(true);
      } catch (err) {
        alert(`Failed to parse voice input: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setParsing(false);
        setTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      setParsing(false);
      setTranscript("");
      const err = event.error;
      if (err === "not-allowed") {
        alert("Microphone access was denied. Click the lock/camera icon in your browser's address bar and allow microphone access, then try again.");
      } else if (err === "no-speech") {
        alert("No speech was detected. Please try again and speak clearly.");
      } else if (err === "audio-capture") {
        alert("No microphone found. Please connect a microphone and try again.");
      } else {
        alert(`Voice error: ${err}. Please try again.`);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setListening(false);
      alert(`Could not start voice input: ${e}`);
    }
  }

  const monthLabel = `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleVoiceToggle}
            disabled={parsing}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              listening
                ? "bg-red-500 hover:bg-red-600 text-white"
                : parsing
                ? "border border-gray-200 text-gray-400 cursor-not-allowed"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            {listening ? "Stop" : parsing ? "Parsing…" : "Voice"}
          </button>
          <button
            onClick={() => openNew()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
          >
            + Add Job
          </button>
        </div>
      </div>

      {/* Voice status bar */}
      {(listening || parsing) && (
        <div className="mb-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${listening ? "bg-red-500 animate-pulse" : "bg-blue-500 animate-pulse"}`} />
          <p className="text-sm text-gray-600 flex-1 italic truncate">
            {parsing ? "Parsing with AI…" : transcript ? `"${transcript}"` : "Listening… speak now"}
          </p>
        </div>
      )}

      {/* Calendar + Details split layout */}
      <div className={`flex flex-col ${selectedEvent ? "md:flex-row md:gap-4 md:items-start" : ""}`}>

        {/* Calendar card */}
        <div className={selectedEvent ? "md:w-1/2" : ""}>
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
                <div className={`overflow-y-auto ${selectedEvent ? "max-h-60 md:max-h-[520px]" : "max-h-[520px]"}`}>
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
                          {HOUR_LABELS.map((_, i) => (
                            <div
                              key={i}
                              className="absolute left-0 right-0 border-t border-gray-100"
                              style={{ top: i * HOUR_HEIGHT }}
                            />
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
                            const isUnverified = ev.is_verified === false;
                            const leftPct = (col / totalCols) * 100;
                            const widthPct = (1 / totalCols) * 100;
                            return (
                              <div
                                key={ev.id}
                                className={`absolute rounded-xl px-2 py-1.5 overflow-hidden z-10 cursor-pointer transition-all ${isSelected ? "ring-2 ring-white ring-offset-1 brightness-90" : "hover:brightness-90"}`}
                                style={{
                                  top: top + 2,
                                  height,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${widthPct}% - 4px)`,
                                  backgroundColor: isUnverified ? "#9ca3af" : "#3b82f6",
                                }}
                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                              >
                                <p className="text-white text-xs font-bold leading-tight truncate">{ev.title}</p>
                                {ev.client && height > 38 && (
                                  <p className="text-white/80 text-xs truncate">{ev.client}</p>
                                )}
                                {height > 54 && ev.start_time && (
                                  <p className="text-white/70 text-xs">
                                    {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                                  </p>
                                )}
                                {isUnverified && height > 30 && (
                                  <p className="text-white/70 text-[10px] font-medium mt-0.5">Unverified</p>
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
        </div>

        {/* Details panel */}
        {selectedEvent && (
          <div className="mt-4 md:mt-0 md:w-1/2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

            {/* Unverified banner */}
            {selectedEvent.is_verified === false && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs font-semibold text-amber-700">Unverified AI draft — review details before confirming</p>
              </div>
            )}

            {/* Panel header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">Job Details</p>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{selectedEvent.title}</h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-xl font-bold flex-shrink-0 mt-0.5"
              >×</button>
            </div>

            {/* Panel body */}
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

            {/* Action buttons */}
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              {selectedEvent.is_verified === false ? (
                <>
                  <button
                    onClick={() => handleVerify(selectedEvent.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => { openEdit(selectedEvent); setSelectedEvent(null); }}
                    className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedEvent.id)}
                    className="px-4 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { openEdit(selectedEvent); setSelectedEvent(null); }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedEvent.id)}
                    className="px-5 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Job" : "Add Job"}</h2>

            {!form.is_verified && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs font-semibold text-amber-700">AI draft — review all fields before saving</p>
              </div>
            )}

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
                {saving ? "Saving…" : form.is_verified ? "Save" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
