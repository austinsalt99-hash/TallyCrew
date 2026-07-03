"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BillableEntry, { BillableEntryData } from "./BillableEntry";
import NonBillableEntry, { NonBillableEntryData } from "./NonBillableEntry";
import JobEventPicker, { JobEvent } from "./JobEventPicker";
import LogHistoryPanel from "./LogHistoryPanel";
import type { LogEntryType } from "@/types/logConfig";

interface DayEntry {
  id: string;
  typeSlug: string;
  typeName: string;
  customFields: Record<string, string>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newBillable(): BillableEntryData {
  return { id: crypto.randomUUID(), client: "", description: "", startTime: "", endTime: "", subEntries: [] };
}

function newNonBillable(): NonBillableEntryData {
  return { id: crypto.randomUUID(), description: "", hours: "" };
}

function storageKey(userId: string, date: string): string {
  return `tallycrew-draft-${userId}-${date}`;
}

function fmt12h(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function calcTotalBillable(entries: BillableEntryData[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.manualHours != null) {
      total += e.manualHours;
    } else if (e.startTime && e.endTime) {
      const [sh, sm] = e.startTime.split(":").map(Number);
      const [eh, em] = e.endTime.split(":").map(Number);
      const mins = eh * 60 + em - (sh * 60 + sm);
      if (mins > 0) total += mins / 60;
    }
  }
  return Math.round(total * 100) / 100;
}

function calcTotalNonBillable(entries: NonBillableEntryData[]): number {
  return Math.round(
    entries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0) * 100
  ) / 100;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

interface TimesheetFormProps {
  previewMode?: boolean;
  userName?: string;
  userId?: string;
}

export default function TimesheetForm({ previewMode = false, userName = "", userId = "preview" }: TimesheetFormProps) {
  const [date, setDate] = useState(today());
  const [dayStartTime, setDayStartTime] = useState("");
  const [dayEndTime, setDayEndTime] = useState("");
  const [billable, setBillable] = useState<BillableEntryData[]>([newBillable()]);
  const [nonBillable, setNonBillable] = useState<NonBillableEntryData[]>([newNonBillable()]);
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [entryTypes, setEntryTypes] = useState<LogEntryType[]>([]);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMsg, setHistoryMsg] = useState("");
  const [linkingEntryId, setLinkingEntryId] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<JobEvent[]>([]);
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [clockElapsed, setClockElapsed] = useState("");
  const [clockInTimestamp, setClockInTimestamp] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState("");
  const [breakStartTimestamp, setBreakStartTimestamp] = useState<number | null>(null);
  const [breakElapsed, setBreakElapsed] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClockIn() {
    const now = new Date();
    setClockInTimestamp(now.getTime());
    setDayStartTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setDayEndTime("");
  }

  function handleClockOut() {
    if (breakStartTimestamp) {
      const mins = Math.round((Date.now() - breakStartTimestamp) / 60000);
      setBreakMinutes((prev) => String((parseFloat(prev) || 0) + mins));
      setBreakStartTimestamp(null);
    }
    const now = new Date();
    setDayEndTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setClockInTimestamp(null);
  }

  function handleBreakStart() {
    setBreakStartTimestamp(Date.now());
  }

  function handleBreakEnd() {
    if (!breakStartTimestamp) return;
    const mins = Math.round((Date.now() - breakStartTimestamp) / 60000);
    setBreakMinutes((prev) => String((parseFloat(prev) || 0) + mins));
    setBreakStartTimestamp(null);
  }

  useEffect(() => {
    fetch("/api/log-config")
      .then((r) => r.json())
      .then((data: LogEntryType[]) => {
        if (!Array.isArray(data)) return;
        setEntryTypes(data);
        const dayTypes = data.filter((t) => t.time_mode === "day");
        setDayEntries(dayTypes.map((t) => ({ id: t.id, typeSlug: t.slug, typeName: t.name, customFields: {} })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!linkingEntryId) return;
    const [y, mo, d] = date.split("-").map(Number);
    const base = new Date(y, mo - 1, d);
    const day = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((day + 6) % 7) + calendarWeekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    fetch(`/api/events?from=${fmt(monday)}&to=${fmt(sunday)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCalendarEvents(data); })
      .catch(() => {});
  }, [linkingEntryId, calendarWeekOffset, date]);

  // Load draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(storageKey(userId, today()));
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.date) setDate(draft.date);
        if (draft.dayStartTime) setDayStartTime(draft.dayStartTime);
        if (draft.dayEndTime) setDayEndTime(draft.dayEndTime);
        if (draft.billable?.length) setBillable(draft.billable);
        if (draft.nonBillable?.length) setNonBillable(draft.nonBillable);
        if (draft.notes) setNotes(draft.notes);
        if (draft.breakMinutes) setBreakMinutes(draft.breakMinutes);
      } catch {}
    }
    setLoaded(true);
  }, [userId]);

  const saveDraft = useCallback(
    (state: {
      employeeName: string;
      date: string;
      dayStartTime: string;
      dayEndTime: string;
      billable: BillableEntryData[];
      nonBillable: NonBillableEntryData[];
      notes: string;
      breakMinutes: string;
    }) => {
      localStorage.setItem(storageKey(userId, today()), JSON.stringify(state));
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    },
    [userId]
  );

  // Live elapsed timer — only runs when user actively pressed Clock In this session
  useEffect(() => {
    if (!clockInTimestamp || dayEndTime) { setClockElapsed(""); return; }
    const ts = clockInTimestamp;
    function tick() {
      const secs = Math.floor((Date.now() - ts) / 1000);
      setClockElapsed(`${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockInTimestamp, dayEndTime]);

  // Live break timer
  useEffect(() => {
    if (!breakStartTimestamp) { setBreakElapsed(""); return; }
    const ts = breakStartTimestamp;
    function tick() {
      const secs = Math.floor((Date.now() - ts) / 1000);
      setBreakElapsed(`${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [breakStartTimestamp]);

  // Auto-save with 1s debounce after initial load
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft({ employeeName: userName, date, dayStartTime, dayEndTime, billable, nonBillable, notes, breakMinutes });
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loaded, userName, date, dayStartTime, dayEndTime, billable, nonBillable, notes, breakMinutes, saveDraft]);

  async function loadPastLog(overrideDate?: string) {
    const targetDate = overrideDate ?? date;
    setHistoryLoading(true);
    setHistoryMsg("");
    try {
      const res = await fetch(`/api/submissions/employee?date=${targetDate}`, { credentials: "include" });
      const data = await res.json();
      if (!data || !data.id) {
        setHistoryMsg(`No log found for ${targetDate}.`);
        return;
      }
      if (data.date) setDate(data.date);
      setDayStartTime(data.day_start_time ?? "");
      setDayEndTime(data.day_end_time ?? "");
      if (data.billable_entries?.length) setBillable(data.billable_entries.map((e: BillableEntryData) => ({ ...e, id: e.id ?? crypto.randomUUID() })));
      if (data.non_billable_entries?.length) setNonBillable(data.non_billable_entries.map((e: NonBillableEntryData) => ({ ...e, id: e.id ?? crypto.randomUUID() })));
      if (data.daily_entries?.length) setDayEntries(data.daily_entries as DayEntry[]);
      setNotes(data.notes ?? "");
      setSubmittedId(data.id);
      setIsEditing(true);
      setHistoryMsg("");
    } catch {
      setHistoryMsg("Failed to load log. Try again.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const addBillable = () => setBillable((prev) => [...prev, newBillable()]);
  const addNonBillable = () => setNonBillable((prev) => [...prev, newNonBillable()]);

  const updateBillable = (entry: BillableEntryData) =>
    setBillable((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));

  const removeBillable = (id: string) =>
    setBillable((prev) => prev.filter((e) => e.id !== id));

  const updateNonBillable = (entry: NonBillableEntryData) =>
    setNonBillable((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));

  const removeNonBillable = (id: string) =>
    setNonBillable((prev) => prev.filter((e) => e.id !== id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (previewMode) return;
    setSubmitState("submitting");
    setErrorMsg("");
    try {
      const payload = {
        date,
        dayStartTime,
        dayEndTime,
        billable,
        nonBillable,
        dailyEntries: dayEntries,
        notes,
        totalBillableHours: calcTotalBillable(billable),
        totalNonBillableHours: calcTotalNonBillable(nonBillable),
        breakMinutes: parseFloat(breakMinutes) || 0,
        ...(isEditing && submittedId ? { id: submittedId } : {}),
      };
      const res = await fetch("/api/submit", {
        method: isEditing && submittedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Submission failed");
      }
      const result = await res.json();
      if (result.id) setSubmittedId(result.id);
      localStorage.removeItem(storageKey(userId, today()));
      setIsEditing(false);
      setSubmitState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setSubmitState("error");
    }
  }

  const totalBillable = calcTotalBillable(billable);
  const totalNonBillable = calcTotalNonBillable(nonBillable);

  if (submitState === "success") {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-10 text-center shadow-sm border border-gray-200">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Hours submitted!</h2>
        <p className="text-gray-500 mb-6">Your timesheet for {date} has been sent.</p>
        <div className="flex flex-col items-center gap-3">
          {submittedId && (
            <button
              onClick={() => {
                setIsEditing(true);
                setSubmitState("idle");
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-6 py-2.5 text-sm"
            >
              Edit this submission
            </button>
          )}
          <button
            onClick={() => {
              setSubmitState("idle");
              setSubmittedId(null);
              setIsEditing(false);
              setDayStartTime("");
              setDayEndTime("");
              setBillable([newBillable()]);
              setNonBillable([newNonBillable()]);
              setNotes("");
              setDate(today());
            }}
            className="text-blue-600 underline text-sm"
          >
            Start a new entry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* History button */}
    <div className="flex items-center justify-between mb-1">
      <button
        type="button"
        onClick={() => setShowHistory(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-blue-600 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/>
        </svg>
        History
      </button>
    </div>

    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preview mode banner */}
      {previewMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          Preview — this is exactly what employees see. No data will be submitted.
        </div>
      )}

      {/* Edit mode banner */}
      {!previewMode && isEditing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center gap-2">
          <span>You&apos;re editing a submitted timesheet. Changes will replace your previous submission.</span>
          <button
            type="button"
            onClick={() => { setIsEditing(false); setSubmitState("success"); }}
            className="text-amber-600 underline self-start sm:ml-3 sm:self-auto"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Header fields */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Submitting as</p>
          <p className="text-base font-semibold text-gray-900">{previewMode ? "Preview User" : userName}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setHistoryMsg(""); }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => loadPastLog()}
              disabled={historyLoading}
              title="Load your log for this date"
              className="px-3 py-3 border border-gray-300 rounded-lg text-gray-400 hover:text-blue-600 hover:border-blue-400 transition-colors disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 15 15" />
              </svg>
            </button>
          </div>
          {historyMsg && (
            <p className={`text-xs mt-1.5 ${historyMsg.startsWith("No log") ? "text-gray-400" : "text-red-500"}`}>
              {historyMsg}
            </p>
          )}
        </div>
      </div>

      {/* Workday Hours */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Workday Hours</p>

        {/* Big clock button */}
        {!dayStartTime ? (
          <button
            type="button"
            onClick={handleClockIn}
            className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-xl py-6 rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-sm mb-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/>
            </svg>
            Clock In
          </button>
        ) : !dayEndTime ? (
          <div className="space-y-4 mb-4">
            {clockInTimestamp && (
              <div className="text-center py-1">
                <p className="text-sm text-gray-400">
                  Clocked in at <span className="font-semibold text-gray-700">{fmt12h(dayStartTime)}</span>
                </p>
                <p className="text-4xl font-bold text-gray-900 tabular-nums mt-2 tracking-tight">{clockElapsed}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleClockOut}
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-xl py-6 rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="3"/>
              </svg>
              Clock Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-4">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Clock in</p>
              <p className="font-semibold text-gray-900">{fmt12h(dayStartTime)}</p>
            </div>
            <div className="text-gray-300 text-lg">→</div>
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Clock out</p>
              <p className="font-semibold text-gray-900">{fmt12h(dayEndTime)}</p>
            </div>
            <button
              type="button"
              onClick={() => { setDayStartTime(""); setDayEndTime(""); setClockInTimestamp(null); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Reset
            </button>
          </div>
        )}

        {/* Manual time inputs — always visible */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-100">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Start time</label>
            <input type="time" value={dayStartTime} onChange={(e) => setDayStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">End time</label>
            <input type="time" value={dayEndTime} onChange={(e) => setDayEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
      </div>

      {/* Break */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Break</p>

        {dayStartTime && !dayEndTime && (
          !breakStartTimestamp ? (
            <button
              type="button"
              onClick={handleBreakStart}
              className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xl py-6 rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-sm mb-4"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5"/>
                <rect x="14" y="4" width="4" height="16" rx="1.5"/>
              </svg>
              Take Break
            </button>
          ) : (
            <div className="space-y-4 mb-4">
              <div className="text-center py-1">
                <p className="text-sm text-gray-400">On break</p>
                <p className="text-4xl font-bold text-amber-500 tabular-nums mt-2 tracking-tight">{breakElapsed}</p>
              </div>
              <button
                type="button"
                onClick={handleBreakEnd}
                className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xl py-6 rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                End Break
              </button>
            </div>
          )
        )}

        <div className={dayStartTime && !dayEndTime ? "pt-4 border-t border-gray-100" : ""}>
          <label className="block text-xs font-medium text-gray-500 mb-1">Total break (minutes)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Billable entries */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Jobs</h2>
        <div className="space-y-3">
          {billable.map((entry) => (
            <BillableEntry
              key={entry.id}
              entry={entry}
              onChange={updateBillable}
              onRemove={() => removeBillable(entry.id)}
              showRemove={billable.length > 1}
              entryTypes={entryTypes}
              onLinkJob={() => { setLinkingEntryId(entry.id); setCalendarWeekOffset(0); }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addBillable}
          className="mt-3 w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors"
        >
          + Add another job
        </button>
        {totalBillable > 0 && (
          <p className="mt-2 text-right text-sm text-gray-500">
            Total job hours: <span className="font-semibold text-gray-800">{totalBillable}h</span>
          </p>
        )}
      </section>

      {/* Daily Activities (day-level log types) */}
      {dayEntries.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">General</h2>
          <div className="space-y-3">
            {dayEntries.map((dayEntry) => {
              const type = entryTypes.find((t) => t.slug === dayEntry.typeSlug);
              if (!type) return null;
              return (
                <div key={dayEntry.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{dayEntry.typeName}</span>
                  {type.fields
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((field) => (
                      <div key={field.id}>
                        <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                        {field.field_type === "dropdown" ? (
                          <select
                            value={dayEntry.customFields[field.field_key] ?? ""}
                            onChange={(e) =>
                              setDayEntries((prev) =>
                                prev.map((de) =>
                                  de.id === dayEntry.id
                                    ? { ...de, customFields: { ...de.customFields, [field.field_key]: e.target.value } }
                                    : de
                                )
                              )
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                          >
                            <option value="">Select {field.label.toLowerCase()}…</option>
                            {field.options
                              .slice()
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((opt) => (
                                <option key={opt.id} value={opt.label}>{opt.label}</option>
                              ))}
                          </select>
                        ) : field.field_type === "number" ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={dayEntry.customFields[field.field_key] ?? ""}
                            onChange={(e) =>
                              setDayEntries((prev) =>
                                prev.map((de) =>
                                  de.id === dayEntry.id
                                    ? { ...de, customFields: { ...de.customFields, [field.field_key]: e.target.value } }
                                    : de
                                )
                              )
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <input
                            type="text"
                            value={dayEntry.customFields[field.field_key] ?? ""}
                            onChange={(e) =>
                              setDayEntries((prev) =>
                                prev.map((de) =>
                                  de.id === dayEntry.id
                                    ? { ...de, customFields: { ...de.customFields, [field.field_key]: e.target.value } }
                                    : de
                                )
                              )
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        )}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Non-billable entries */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Non-Billable Time</h2>
        <div className="space-y-3">
          {nonBillable.map((entry) => (
            <NonBillableEntry
              key={entry.id}
              entry={entry}
              onChange={updateNonBillable}
              onRemove={() => removeNonBillable(entry.id)}
              showRemove={nonBillable.length > 1}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addNonBillable}
          className="mt-3 w-full py-3 border-2 border-dashed border-orange-300 rounded-xl text-orange-500 font-medium text-sm hover:bg-orange-50 transition-colors"
        >
          + Add another non-billable entry
        </button>
        {totalNonBillable > 0 && (
          <p className="mt-2 text-right text-sm text-gray-500">
            Total non-billable: <span className="font-semibold text-gray-800">{totalNonBillable}h</span>
          </p>
        )}
      </section>

      {/* Notes */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          placeholder="Anything else to mention about today..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
      </div>

      {/* Draft saved indicator */}
      {savedAt && submitState === "idle" && (
        <p className="text-center text-xs text-gray-400">Draft saved at {savedAt}</p>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      {previewMode ? (
        <div className="w-full bg-gray-100 border border-gray-200 text-gray-400 font-bold text-lg py-4 rounded-2xl text-center">
          Submit for the Day
        </div>
      ) : (
        <button
          type="submit"
          disabled={submitState === "submitting"}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-lg py-4 rounded-2xl transition-colors shadow-sm"
        >
          {submitState === "submitting"
            ? (isEditing ? "Updating..." : "Submitting...")
            : (isEditing ? "Update Submission" : "Submit for the Day")}
        </button>
      )}
    </form>

    {showHistory && (
      <LogHistoryPanel
        onLoadDate={(selectedDate) => {
          setDate(selectedDate);
          loadPastLog(selectedDate);
        }}
        onClose={() => setShowHistory(false)}
      />
    )}

    {linkingEntryId && (
      <JobEventPicker
        events={calendarEvents}
        baseDate={date}
        weekOffset={calendarWeekOffset}
        onPrev={() => setCalendarWeekOffset((o) => o - 1)}
        onNext={() => setCalendarWeekOffset((o) => o + 1)}
        onSelect={(event) => {
          const entry = billable.find((e) => e.id === linkingEntryId);
          if (entry) {
            updateBillable({
              ...entry,
              linkedEventId: event.id,
              linkedEventTitle: `${event.title}${event.client ? ` – ${event.client}` : ""}`,
              client: event.client ?? entry.client,
              description: event.title,
              startTime: event.start_time ?? entry.startTime,
              endTime: event.end_time ?? entry.endTime,
            });
          }
          setLinkingEntryId(null);
        }}
        onClose={() => setLinkingEntryId(null)}
      />
    )}
    </>
  );
}
