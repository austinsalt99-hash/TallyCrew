"use client";

import { useEffect, useState } from "react";

interface Worker {
  id: string;
  full_name: string;
  role: string;
}

interface AvailabilityRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  date_start: string;
  date_end: string;
  status: "pending" | "approved" | "denied";
  notes?: string;
  created_at: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthDays(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const endPad = (7 - lastOfMonth.getDay()) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startPad);
  const totalDays = startPad + lastOfMonth.getDate() + endPad;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function fmtDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

export default function AvailabilityGrid() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const monthDays = getMonthDays(year, month);
  const firstDay = fmt(new Date(year, month, 1));
  const lastDay = fmt(new Date(year, month + 1, 0));
  const todayStr = fmt(new Date());

  useEffect(() => {
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setWorkers(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/availability?from=${firstDay}&to=${lastDay}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("api_error");
        return r.json();
      })
      .then((data) => { setRequests(Array.isArray(data) ? data : []); setLoading(false); setApiError(false); })
      .catch(() => { setApiError(true); setLoading(false); });
  }, [firstDay, lastDay]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    await fetch("/api/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status: "approved" }),
    });
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" } : r));
    setActionLoading(null);
  }

  async function handleDeny(id: string) {
    setActionLoading(id);
    await fetch("/api/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status: "denied" }),
    });
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "denied" } : r));
    setActionLoading(null);
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    await fetch("/api/availability", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setActionLoading(null);
  }

  function goBack() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function goForward() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const crew = workers.filter((w) => w.role === "worker");
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");

  function getWorkerStatusForDay(workerId: string, dateStr: string): "unavailable" | "pending" | "available" {
    const req = requests.find(
      (r) => r.employee_id === workerId && isDateInRange(dateStr, r.date_start, r.date_end)
    );
    if (!req) return "available";
    if (req.status === "approved") return "unavailable";
    if (req.status === "pending") return "pending";
    return "available";
  }

  if (apiError) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-4 text-center">
        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Database migration required</p>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            The availability feature requires a new database table. Run the following SQL in your Supabase SQL Editor to enable it.
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-left max-w-lg mx-auto overflow-x-auto">
          <pre className="text-xs text-green-400 whitespace-pre">{`CREATE TABLE availability_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE availability_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members can view"
  ON availability_requests FOR SELECT
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "employees can insert own"
  ON availability_requests FOR INSERT
  WITH CHECK (
    employee_id = auth.uid() AND
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "company members can update"
  ON availability_requests FOR UPDATE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "company members can delete"
  ON availability_requests FOR DELETE
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));`}</pre>
        </div>
        <p className="text-xs text-gray-400">After running the SQL, refresh this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >‹</button>
          <h2 className="text-base font-bold text-gray-900">{MONTHS[month]} {year}</h2>
          <button
            onClick={goForward}
            className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
          >›</button>
          {(year !== now.getFullYear() || month !== now.getMonth()) && (
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
              className="text-sm font-semibold text-navy-600 underline"
            >
              This month
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {[
            { color: "#22c55e", label: "Available" },
            { color: "#f59e0b", label: "Pending request" },
            { color: "#ef4444", label: "Approved off" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending requests banner */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{pendingRequests.length}</span>
          </div>
          <p className="text-sm font-semibold text-amber-800">
            {pendingRequests.length} pending time-off request{pendingRequests.length !== 1 ? "s" : ""} — review below
          </p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Loading availability…</p>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          {crew.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-sm text-gray-400">No crew members found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 760 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200" style={{ width: 140, minWidth: 120 }}>
                        Team Member
                      </th>
                      {/* Show 7 days per row — show all days of month in groups of 7 */}
                      {Array.from({ length: 31 }, (_, i) => {
                        const d = new Date(year, month, i + 1);
                        if (d.getMonth() !== month) return null;
                        const dateStr = fmt(d);
                        const isToday = dateStr === todayStr;
                        const dayOfWeek = (d.getDay() + 6) % 7;
                        return (
                          <th
                            key={dateStr}
                            className={`px-0 py-2 text-center border-r border-gray-100 ${isToday ? "bg-blue-50" : ""}`}
                            style={{ minWidth: 36 }}
                          >
                            <div className={`text-[9px] font-semibold uppercase ${isToday ? "text-blue-400" : "text-gray-300"}`}>
                              {DAY_NAMES[dayOfWeek][0]}
                            </div>
                            <div className={`text-xs font-bold ${isToday ? "text-blue-600" : "text-gray-600"}`}>
                              {i + 1}
                            </div>
                          </th>
                        );
                      }).filter(Boolean)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {crew.map((worker) => (
                      <tr key={worker.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {worker.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-gray-800 truncate">{worker.full_name}</span>
                          </div>
                        </td>
                        {Array.from({ length: 31 }, (_, i) => {
                          const d = new Date(year, month, i + 1);
                          if (d.getMonth() !== month) return null;
                          const dateStr = fmt(d);
                          const status = getWorkerStatusForDay(worker.id, dateStr);
                          const isToday = dateStr === todayStr;
                          const colors = {
                            available: isToday ? "#bfdbfe" : "transparent",
                            pending: "#fde68a",
                            unavailable: "#fca5a5",
                          };
                          return (
                            <td
                              key={dateStr}
                              className="border-r border-gray-50 text-center py-2"
                              style={{ backgroundColor: colors[status] }}
                            >
                              {status === "unavailable" && (
                                <div className="w-4 h-4 rounded-full bg-red-400 mx-auto flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">✕</span>
                                </div>
                              )}
                              {status === "pending" && (
                                <div className="w-4 h-4 rounded-full bg-amber-400 mx-auto flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">?</span>
                                </div>
                              )}
                              {status === "available" && isToday && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mx-auto" />
                              )}
                            </td>
                          );
                        }).filter(Boolean)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Requests list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Time-off Requests — {SHORT_MONTHS[month]} {year}
              </p>
              {requests.length > 0 && (
                <span className="text-xs text-gray-400">{requests.length} total</span>
              )}
            </div>

            {requests.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-sm text-gray-400">No time-off requests for this month.</p>
                <p className="text-xs text-gray-400 mt-1">Employees can submit requests from their profile page.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests
                  .sort((a, b) => {
                    const order = { pending: 0, approved: 1, denied: 2 };
                    return order[a.status] - order[b.status];
                  })
                  .map((req) => {
                    const workerName = req.employee_name ??
                      crew.find((w) => w.id === req.employee_id)?.full_name ?? "Unknown";
                    const sameDay = req.date_start === req.date_end;
                    const dateLabel = sameDay
                      ? fmtDisplayDate(req.date_start)
                      : `${fmtDisplayDate(req.date_start)} – ${fmtDisplayDate(req.date_end)}`;

                    const statusStyle = {
                      pending: "bg-amber-50 border-amber-200",
                      approved: "bg-green-50 border-green-200",
                      denied: "bg-gray-50 border-gray-200",
                    }[req.status];

                    const statusBadge = {
                      pending: "bg-amber-100 text-amber-700",
                      approved: "bg-green-100 text-green-700",
                      denied: "bg-gray-100 text-gray-500",
                    }[req.status];

                    return (
                      <div key={req.id} className={`border rounded-xl p-3.5 flex items-start gap-3 ${statusStyle}`}>
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {workerName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{workerName}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadge}`}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{dateLabel}</p>
                          {req.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{req.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {req.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(req.id)}
                                disabled={actionLoading === req.id}
                                className="px-2.5 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDeny(req.id)}
                                disabled={actionLoading === req.id}
                                className="px-2.5 py-1 text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
                              >
                                Deny
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(req.id)}
                            disabled={actionLoading === req.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 disabled:opacity-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
