"use client";

import { useEffect, useState } from "react";

interface SubmissionSummary {
  id: string;
  date: string;
  total_billable_hours: number;
  total_non_billable_hours: number;
  break_minutes: number;
}

interface Props {
  onLoadDate: (date: string) => void;
  onClose: () => void;
}

function getRecentRange(): { from: string; to: string } {
  const today = new Date();
  const past = new Date(today);
  past.setDate(today.getDate() - 90);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(past), to: fmt(today) };
}

function formatDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function groupByWeek(submissions: SubmissionSummary[]): { label: string; items: SubmissionSummary[] }[] {
  const groups: Record<string, SubmissionSummary[]> = {};
  for (const sub of submissions) {
    const [y, mo, d] = sub.date.split("-").map(Number);
    const date = new Date(y, mo - 1, d);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const [y, mo, d] = key.split("-").map(Number);
      const monday = new Date(y, mo - 1, d);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (dt: Date) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { label: `${fmt(monday)} – ${fmt(sunday)}`, items };
    });
}

export default function LogHistoryPanel({ onLoadDate, onClose }: Props) {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [jumpDate, setJumpDate] = useState("");

  useEffect(() => {
    const { from, to } = getRecentRange();
    fetch(`/api/submissions/employee?from=${from}&to=${to}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSubmissions(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = groupByWeek(submissions);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, right sidebar on desktop */}
      <div className="absolute inset-x-0 bottom-0 max-h-[78vh] rounded-t-2xl bg-white shadow-xl flex flex-col md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-80 md:rounded-none">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/>
            </svg>
            <h2 className="font-semibold text-gray-900">Log History</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-xl leading-none">×</button>
        </div>

        {/* Jump to date */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <p className="text-xs font-medium text-gray-500 mb-2">Jump to a specific date</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={jumpDate}
              onChange={(e) => setJumpDate(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={() => { if (jumpDate) { onLoadDate(jumpDate); onClose(); } }}
              disabled={!jumpDate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Load
            </button>
          </div>
        </div>

        {/* Submissions list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Loading…</div>
          ) : groups.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">No logs found in the last 90 days.</div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-5 pt-4 pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{group.label}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.items.map((sub) => {
                    const billable = sub.total_billable_hours || 0;
                    const nonBillable = sub.total_non_billable_hours || 0;
                    const total = Math.round((billable + nonBillable) * 100) / 100;
                    return (
                      <div key={sub.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{formatDate(sub.date)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {total === 0 ? (
                              "No hours logged"
                            ) : (
                              <>
                                {billable > 0 && <span className="text-blue-600">{billable}h billable</span>}
                                {billable > 0 && nonBillable > 0 && " · "}
                                {nonBillable > 0 && <span className="text-orange-500">{nonBillable}h non-billable</span>}
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => { onLoadDate(sub.date); onClose(); }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors shrink-0 ml-3"
                        >
                          Load
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
