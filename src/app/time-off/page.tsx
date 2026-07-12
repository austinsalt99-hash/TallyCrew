"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import DesktopHeader from "@/components/DesktopHeader";

interface Request {
  id: string;
  date_start: string;
  date_end: string;
  status: "pending" | "approved" | "denied";
  notes?: string;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function TimeOffPage() {
  const today = new Date().toISOString().split("T")[0];

  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Request | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateStart || !dateEnd || dateEnd < dateStart) {
      setError("Please select valid dates.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date_start: dateStart, date_end: dateEnd, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setSubmitted(data);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopHeader />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Request Time Off</h1>
          <p className="text-sm text-gray-500 mt-1">Submit a request for time off. Your admin will review and approve it.</p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Request submitted!</p>
              <p className="text-sm text-gray-500 mt-1">
                {submitted.date_start === submitted.date_end
                  ? fmtDate(submitted.date_start)
                  : `${fmtDate(submitted.date_start)} – ${fmtDate(submitted.date_end)}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">Your admin will review your request and let you know.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setSubmitted(null)}
                className="px-5 py-2.5 bg-navy-600 hover:bg-navy-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Submit another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">First day off</label>
                <input
                  type="date"
                  value={dateStart}
                  min={today}
                  onChange={(e) => {
                    setDateStart(e.target.value);
                    if (e.target.value > dateEnd) setDateEnd(e.target.value);
                  }}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Last day off</label>
                <input
                  type="date"
                  value={dateEnd}
                  min={dateStart}
                  onChange={(e) => setDateEnd(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
            </div>

            {dateStart && dateEnd && dateStart <= dateEnd && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <p className="text-xs text-blue-700 font-medium">
                  {dateStart === dateEnd
                    ? `1 day — ${fmtDate(dateStart)}`
                    : (() => {
                        const [y1, m1, d1] = dateStart.split("-").map(Number);
                        const [y2, m2, d2] = dateEnd.split("-").map(Number);
                        const days = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000) + 1;
                        return `${days} days — ${fmtDate(dateStart)} through ${fmtDate(dateEnd)}`;
                      })()}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vacation, appointment, personal day…"
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-navy-600 hover:bg-navy-700 disabled:bg-navy-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Requests are pending until your admin approves them. Plan accordingly.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
