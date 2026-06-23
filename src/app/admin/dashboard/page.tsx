"use client";

import { useEffect, useState } from "react";

interface WorkTypeData {
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
}

interface BillableEntry {
  client: string;
  description: string;
  startTime: string;
  endTime: string;
  entryType?: string;
  customFields?: Record<string, string>;
  _typeData?: Record<string, WorkTypeData>;
  photos?: string[];
}
interface NonBillableEntry { description: string; hours: string; }
interface Submission {
  id: string;
  submitted_at: string;
  employee_name: string;
  date: string;
  day_start_time?: string;
  day_end_time?: string;
  billable_entries: BillableEntry[];
  non_billable_entries: NonBillableEntry[];
  notes: string;
  total_billable_hours: number;
  total_non_billable_hours: number;
}

interface WorkItem {
  slug: string;
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
}

function getWorkItems(entry: BillableEntry): WorkItem[] {
  const items: WorkItem[] = [];
  const activeSlug = entry.entryType ?? "standard";

  if (activeSlug === "standard") {
    if (entry.client || entry.description) {
      items.push({ slug: "standard", client: entry.client, description: entry.description });
    }
  } else if (entry.customFields && Object.values(entry.customFields).some(Boolean)) {
    items.push({ slug: activeSlug, customFields: entry.customFields });
  }

  for (const [slug, data] of Object.entries(entry._typeData ?? {})) {
    if (slug === "standard") {
      if (data.client || data.description) {
        items.push({ slug: "standard", client: data.client, description: data.description });
      }
    } else if (data.customFields && Object.values(data.customFields).some(Boolean)) {
      items.push({ slug, customFields: data.customFields });
    }
  }

  return items;
}

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function calcWorkedHours(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDateLabel(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterName, setFilterName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("cew-admin-token") ?? "";
    fetch("/api/submissions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setSubmissions(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const filtered = submissions.filter((s) => {
    if (filterDate && s.date !== filterDate) return false;
    if (filterName && !s.employee_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    return true;
  });

  if (loading) return <p className="text-gray-500">Loading submissions...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Hour Logs</h1>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Filter by employee name"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
        />
        {(filterDate || filterName) && (
          <button onClick={() => { setFilterDate(""); setFilterName(""); }} className="text-sm text-blue-600 underline">
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400">No submissions found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s, i) => {
            const prevDate = i > 0 ? filtered[i - 1].date : null;
            const showSeparator = prevDate !== null && prevDate !== s.date;
            const workedHours = calcWorkedHours(s.day_start_time, s.day_end_time);
            return (
              <div key={s.id}>
                {showSeparator && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 border-t border-dashed border-gray-300" />
                    <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{formatDateLabel(s.date)}</span>
                    <div className="flex-1 border-t border-dashed border-gray-300" />
                  </div>
                )}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">{s.employee_name}</span>
                      <span className="text-gray-400 mx-2">·</span>
                      <span className="text-gray-600">{s.date}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {workedHours && (
                        <span className="text-gray-700 font-semibold">{workedHours} worked</span>
                      )}
                      <span className="text-blue-600 font-medium">{s.total_billable_hours}h billable</span>
                      {s.total_non_billable_hours > 0 && (
                        <span className="text-orange-500">{s.total_non_billable_hours}h non-bill.</span>
                      )}
                      <span className="text-gray-400">{expanded === s.id ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expanded === s.id && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                      {s.day_start_time && s.day_end_time && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Workday</span>
                          <span className="mx-1 text-gray-300">|</span>
                          <span>{formatTime(s.day_start_time)} – {formatTime(s.day_end_time)}</span>
                          {workedHours && (
                            <span className="ml-auto font-semibold text-gray-700">{workedHours}</span>
                          )}
                        </div>
                      )}

                      {/* Jobs */}
                      {s.billable_entries?.some(e => getWorkItems(e).length > 0) && (
                        <div>
                          <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Jobs</h3>
                          <div className="space-y-2">
                            {s.billable_entries.map((entry, ji) => {
                              const workItems = getWorkItems(entry);
                              if (!workItems.length) return null;
                              const jobHours = calcWorkedHours(entry.startTime, entry.endTime);
                              return (
                                <div key={ji} className="bg-gray-50 rounded-lg p-3">
                                  <div className="text-xs text-gray-400 font-medium mb-2">
                                    {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                                    {jobHours && <span className="ml-2 text-gray-500 font-semibold">{jobHours}</span>}
                                  </div>
                                  <div className="space-y-2">
                                    {workItems.map((item, wi) => (
                                      <div key={wi} className="flex gap-2 items-start">
                                        <span className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                          item.slug === "standard"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-indigo-100 text-indigo-700"
                                        }`}>
                                          {item.slug === "standard" ? "Standard" : item.slug.replace(/-/g, " ")}
                                        </span>
                                        <div className="text-sm text-gray-700">
                                          {item.slug === "standard" ? (
                                            <>
                                              {item.client && <span className="font-medium">{item.client}</span>}
                                              {item.client && item.description && <span className="text-gray-400"> — </span>}
                                              {item.description && <span>{item.description}</span>}
                                            </>
                                          ) : (
                                            <div className="space-y-0.5">
                                              {Object.entries(item.customFields ?? {}).filter(([, v]) => v).map(([k, v]) => (
                                                <div key={k} className="text-xs text-gray-600">
                                                  <span className="text-gray-400">{k.replace(/_/g, " ")}: </span>{v}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {entry.photos && entry.photos.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-200">
                                      {entry.photos.map((url) => (
                                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                          <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {s.non_billable_entries?.filter(e => e.description).length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Non-Billable</h3>
                          <table className="w-full text-sm">
                            <tbody>
                              {s.non_billable_entries.filter(e => e.description).map((e, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="py-1.5 pr-4 text-gray-700">{e.description}</td>
                                  <td className="py-1.5 text-gray-500">{e.hours}h</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {s.notes && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h3>
                          <p className="text-sm text-gray-700">{s.notes}</p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-100">
                        {confirmDelete === s.id ? (
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-600">Delete this log? This can&apos;t be undone.</span>
                            <button
                              onClick={async () => {
                                const token = localStorage.getItem("cew-admin-token") ?? "";
                                await fetch("/api/submissions", {
                                  method: "DELETE",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ id: s.id }),
                                });
                                setSubmissions((prev) => prev.filter((x) => x.id !== s.id));
                                setConfirmDelete(null);
                                setExpanded(null);
                              }}
                              className="text-red-600 font-semibold hover:text-red-700"
                            >
                              Yes, delete
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:text-gray-600">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(s.id)}
                            className="text-sm text-red-500 hover:text-red-700"
                          >
                            Delete this log
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
