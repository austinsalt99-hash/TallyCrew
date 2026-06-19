"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BillableEntry, { BillableEntryData } from "./BillableEntry";
import NonBillableEntry, { NonBillableEntryData } from "./NonBillableEntry";

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
  const [billable, setBillable] = useState<BillableEntryData[]>([newBillable()]);
  const [nonBillable, setNonBillable] = useState<NonBillableEntryData[]>([newNonBillable()]);
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(storageKey(today()));
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.employeeName) setEmployeeName(draft.employeeName);
        if (draft.date) setDate(draft.date);
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
      saveDraft({ employeeName, date, billable, nonBillable, notes });
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loaded, employeeName, date, billable, nonBillable, notes, saveDraft]);

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
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: employeeName.trim(),
          date,
          billable,
          nonBillable,
          notes,
          totalBillableHours: calcTotalBillable(billable),
          totalNonBillableHours: calcTotalNonBillable(nonBillable),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Submission failed");
      }
      localStorage.removeItem(storageKey(today()));
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
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-200">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Hours submitted!</h2>
        <p className="text-gray-500 mb-6">Your timesheet for {date} has been sent.</p>
        <button
          onClick={() => {
            setSubmitState("idle");
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        {submitState === "submitting" ? "Submitting..." : "Submit for the Day"}
      </button>
    </form>
  );
}
