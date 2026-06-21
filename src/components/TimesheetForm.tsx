"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BillableEntry, { BillableEntryData } from "./BillableEntry";
import NonBillableEntry, { NonBillableEntryData } from "./NonBillableEntry";
import type { LogEntryType } from "@/types/logConfig";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newBillable(): BillableEntryData {
  return { id: crypto.randomUUID(), client: "", description: "", startTime: "", endTime: "" };
}

function newNonBillable(): NonBillableEntryData {
  return { id: crypto.randomUUID(), description: "", hours: "" };
}

function storageKey(date: string): string {
  return `cew-draft-${date}`;
}

function calcTotalBillable(entries: BillableEntryData[]): number {
  let total = 0;
  for (const e of entries) {
    if (!e.startTime || !e.endTime) continue;
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    if (mins > 0) total += mins / 60;
  }
  return Math.round(total * 100) / 100;
}

function calcTotalNonBillable(entries: NonBillableEntryData[]): number {
  return Math.round(
    entries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0) * 100
  ) / 100;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function TimesheetForm() {
  const [employeeName, setEmployeeName] = useState("");
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/log-config")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEntryTypes(data); })
      .catch(() => {});
  }, []);

  // Load draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(storageKey(today()));
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.employeeName) setEmployeeName(draft.employeeName);
        if (draft.date) setDate(draft.date);
        if (draft.dayStartTime) setDayStartTime(draft.dayStartTime);
        if (draft.dayEndTime) setDayEndTime(draft.dayEndTime);
        if (draft.billable?.length) setBillable(draft.billable);
        if (draft.nonBillable?.length) setNonBillable(draft.nonBillable);
        if (draft.notes) setNotes(draft.notes);
      } catch {}
    }
    setLoaded(true);
  }, []);

  const saveDraft = useCallback(
    (state: {
      employeeName: string;
      date: string;
      dayStartTime: string;
      dayEndTime: string;
      billable: BillableEntryData[];
      nonBillable: NonBillableEntryData[];
      notes: string;
    }) => {
      localStorage.setItem(storageKey(today()), JSON.stringify(state));
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    },
    []
  );

  // Auto-save with 1s debounce after initial load
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft({ employeeName, date, dayStartTime, dayEndTime, billable, nonBillable, notes });
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loaded, employeeName, date, dayStartTime, dayEndTime, billable, nonBillable, notes, saveDraft]);

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
    if (!employeeName.trim()) {
      setErrorMsg("Please enter your name before submitting.");
      return;
    }
    setSubmitState("submitting");
    setErrorMsg("");
    try {
      const payload = {
        employeeName: employeeName.trim(),
        date,
        dayStartTime,
        dayEndTime,
        billable,
        nonBillable,
        notes,
        totalBillableHours: calcTotalBillable(billable),
        totalNonBillableHours: calcTotalNonBillable(nonBillable),
        ...(isEditing && submittedId ? { id: submittedId } : {}),
      };
      const res = await fetch("/api/submit", {
        method: isEditing && submittedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Submission failed");
      }
      const result = await res.json();
      if (result.id) setSubmittedId(result.id);
      localStorage.removeItem(storageKey(today()));
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Edit mode banner */}
      {isEditing && (
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
          <input
            type="text"
            placeholder="First and last name"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Workday times */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Workday Hours</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
            <input
              type="time"
              value={dayStartTime}
              onChange={(e) => setDayStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
            <input
              type="time"
              value={dayEndTime}
              onChange={(e) => setDayEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Billable entries */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Billable Hours</h2>
        <div className="space-y-3">
          {billable.map((entry) => (
            <BillableEntry
              key={entry.id}
              entry={entry}
              onChange={updateBillable}
              onRemove={() => removeBillable(entry.id)}
              showRemove={billable.length > 1}
              entryTypes={entryTypes}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addBillable}
          className="mt-3 w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors"
        >
          + Add another billable entry
        </button>
        {totalBillable > 0 && (
          <p className="mt-2 text-right text-sm text-gray-500">
            Total billable: <span className="font-semibold text-gray-800">{totalBillable}h</span>
          </p>
        )}
      </section>

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
      <button
        type="submit"
        disabled={submitState === "submitting"}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-lg py-4 rounded-2xl transition-colors shadow-sm"
      >
        {submitState === "submitting"
          ? (isEditing ? "Updating..." : "Submitting...")
          : (isEditing ? "Update Submission" : "Submit for the Day")}
      </button>
    </form>
  );
}
