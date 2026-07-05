"use client";

import { useEffect, useState } from "react";
import JobEventPicker, { type JobEvent } from "@/components/JobEventPicker";

interface DashJobEvent extends JobEvent {
  location?: string;
  description?: string;
  assigned_to?: string;
}

interface WorkTypeData {
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

interface BillableSubEntry {
  id: string;
  slug: string;
  customFields?: Record<string, string>;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

interface BillableEntry {
  client: string;
  description: string;
  startTime: string;
  endTime: string;
  manualHours?: number;
  customFields?: Record<string, string>;
  subEntries?: BillableSubEntry[];
  photos?: string[];
  linkedEventId?: string;
  linkedEventTitle?: string;
  // Old format fields:
  entryType?: string;
  _typeData?: Record<string, WorkTypeData>;
}
interface NonBillableEntry { description: string; hours: string; }
interface DailyEntry { typeSlug: string; typeName: string; customFields: Record<string, string>; }
interface Submission {
  id: string;
  submitted_at: string;
  employee_name: string;
  date: string;
  day_start_time?: string;
  day_end_time?: string;
  billable_entries: BillableEntry[];
  non_billable_entries: NonBillableEntry[];
  daily_entries?: DailyEntry[];
  notes: string;
  total_billable_hours: number;
  total_non_billable_hours: number;
  break_minutes?: number;
}

interface WorkItem {
  slug: string;
  hours?: string;
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
}

function hoursFromData(start?: string, end?: string, manual?: number): string | undefined {
  if (manual != null) return `${manual}h`;
  if (!start || !end) return undefined;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return undefined;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getWorkItems(entry: BillableEntry): WorkItem[] {
  // New format: subEntries array present
  if (entry.subEntries != null) {
    const items: WorkItem[] = [];
    if (entry.client || entry.description) {
      items.push({ slug: "standard", hours: hoursFromData(entry.startTime, entry.endTime, entry.manualHours), client: entry.client, description: entry.description });
    }
    for (const sub of entry.subEntries) {
      items.push({ slug: sub.slug, hours: hoursFromData(sub.startTime, sub.endTime, sub.manualHours), customFields: sub.customFields });
    }
    return items;
  }

  // Old format: entryType + _typeData
  const items: WorkItem[] = [];
  const activeSlug = entry.entryType ?? "standard";

  if (activeSlug === "standard") {
    if (entry.client || entry.description) {
      items.push({ slug: "standard", hours: hoursFromData(entry.startTime, entry.endTime, entry.manualHours), client: entry.client, description: entry.description });
    }
  } else if (entry.customFields && Object.values(entry.customFields).some(Boolean)) {
    items.push({ slug: activeSlug, hours: hoursFromData(entry.startTime, entry.endTime, entry.manualHours), customFields: entry.customFields });
  }

  for (const [slug, data] of Object.entries(entry._typeData ?? {})) {
    if (slug === "standard") {
      if (data.client || data.description) {
        items.push({ slug: "standard", hours: hoursFromData(data.startTime, data.endTime, data.manualHours), client: data.client, description: data.description });
      }
    } else if (data.customFields && Object.values(data.customFields).some(Boolean)) {
      items.push({ slug, hours: hoursFromData(data.startTime, data.endTime, data.manualHours), customFields: data.customFields });
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

function slugToLabel(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function calcWorkedHours(start?: string, end?: string, manualHours?: number): string | null {
  if (manualHours != null) return `${manualHours}h`;
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

function formatShortDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterName, setFilterName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [events, setEvents] = useState<DashJobEvent[]>([]);
  const [viewingEvent, setViewingEvent] = useState<DashJobEvent | null>(null);
  const [linkingTarget, setLinkingTarget] = useState<{ submissionId: string; entryIndex: number; date: string } | null>(null);
  const [linkWeekOffset, setLinkWeekOffset] = useState(0);

  useEffect(() => {
    fetch("/api/submissions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setSubmissions(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/events", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []));
  }, []);

  async function handleAdminLink(event: JobEvent) {
    if (!linkingTarget) return;
    const sub = submissions.find((s) => s.id === linkingTarget.submissionId);
    if (!sub) return;
    const linkedEventTitle = event.client ? `${event.title} – ${event.client}` : event.title;
    await fetch("/api/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: sub.id, entryIndex: linkingTarget.entryIndex, linkedEventId: event.id, linkedEventTitle }),
    });
    setSubmissions((prev) => prev.map((s) =>
      s.id === linkingTarget.submissionId
        ? { ...s, billable_entries: s.billable_entries.map((e, i) => i === linkingTarget.entryIndex ? { ...e, linkedEventId: event.id, linkedEventTitle } : e) }
        : s
    ));
    setLinkingTarget(null);
  }

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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
        />
        <input
          type="text"
          placeholder="Filter by employee name"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 w-48"
        />
        {(filterDate || filterName) && (
          <button onClick={() => { setFilterDate(""); setFilterName(""); }} className="text-sm text-navy-600 underline">
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
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{s.employee_name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{formatShortDate(s.date)}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-sm">
                        {workedHours && <div className="text-gray-700 font-semibold">{workedHours} worked</div>}
                        <div className="text-navy-600 font-medium">{s.total_billable_hours}h billable</div>
                        {s.total_non_billable_hours > 0 && <div className="text-orange-500">{s.total_non_billable_hours}h non-bill.</div>}
                      </div>
                      <span className="text-gray-400 text-sm">{expanded === s.id ? "▲" : "▼"}</span>
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
                          <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2">Jobs</h3>
                          <div className="space-y-2">
                            {s.billable_entries.map((entry, ji) => {
                              const workItems = getWorkItems(entry);
                              if (!workItems.length) return null;
                              const jobHours = calcWorkedHours(entry.startTime, entry.endTime, entry.manualHours);
                              const hasTimes = !!(entry.startTime && entry.endTime) || entry.manualHours != null;
                              const isDayLevel = !hasTimes && !!(entry.entryType && entry.entryType !== "standard");
                              return (
                                <div key={ji} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                  {/* Job header */}
                                  <div className="flex flex-wrap items-center gap-2 text-sm bg-navy-50 px-3 py-2">
                                    <span className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Job {ji + 1}</span>
                                    {hasTimes && (
                                      <>
                                        {entry.startTime && entry.endTime && (
                                          <>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-gray-600">{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</span>
                                          </>
                                        )}
                                        {jobHours && <span className="font-semibold text-gray-700">{jobHours}</span>}
                                      </>
                                    )}
                                    {isDayLevel && (
                                      <span className="text-xs bg-navy-100 text-navy-600 px-2 py-0.5 rounded-full">General</span>
                                    )}
                                    {entry.linkedEventTitle ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const found = events.find((ev) => ev.id === entry.linkedEventId);
                                          setViewingEvent(found ?? { id: entry.linkedEventId ?? "", date: s.date, title: entry.linkedEventTitle! });
                                        }}
                                        className="ml-auto text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors"
                                      >
                                        <svg className="inline w-3 h-3 mr-1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95l-.87.87"/><path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-1.5 1.5a3.5 3.5 0 0 0 4.95 4.95l.87-.87"/></svg>{entry.linkedEventTitle}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => { setLinkingTarget({ submissionId: s.id, entryIndex: ji, date: s.date }); setLinkWeekOffset(0); }}
                                        className="ml-auto text-xs text-gray-400 border border-dashed border-gray-300 px-2 py-0.5 rounded-full hover:text-navy-600 hover:border-navy-300 hover:bg-navy-50 transition-colors"
                                      >
                                        <svg className="inline w-3 h-3 mr-1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95l-.87.87"/><path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-1.5 1.5a3.5 3.5 0 0 0 4.95 4.95l.87-.87"/></svg>Link to schedule
                                      </button>
                                    )}
                                  </div>
                                  {/* Work items */}
                                  <div className="px-3 py-2 space-y-2">
                                    {workItems.map((item, wi) => (
                                      <div key={wi} className="flex gap-2 items-start">
                                        <span className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 ${
                                          item.slug === "standard"
                                            ? "bg-navy-100 text-navy-700"
                                            : "bg-indigo-100 text-indigo-700"
                                        }`}>
                                          {item.slug === "standard" ? "General" : slugToLabel(item.slug)}
                                          {item.hours && (
                                            <span className="font-bold opacity-70">· {item.hours}</span>
                                          )}
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
                                  {/* Photos */}
                                  {entry.photos && entry.photos.length > 0 && (
                                    <div className="flex flex-wrap gap-2 px-3 pb-2 pt-1 border-t border-gray-100">
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

                      {s.daily_entries && s.daily_entries.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2">General</h3>
                          <div className="space-y-2">
                            {s.daily_entries.map((de, di) => (
                              <div key={di} className="bg-gray-50 rounded-lg px-3 py-2">
                                <span className="text-xs font-semibold text-navy-600 uppercase tracking-wide">{de.typeName}</span>
                                <div className="mt-1 space-y-0.5">
                                  {Object.entries(de.customFields ?? {}).filter(([, v]) => v).map(([k, v]) => (
                                    <div key={k} className="text-xs text-gray-600">
                                      <span className="text-gray-400">{k.replace(/_/g, " ")}: </span>{v}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
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
                                await fetch("/api/submissions", {
                                  method: "DELETE",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
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

      {/* Event detail modal */}
      {viewingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewingEvent(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5 text-green-600">Job Details</p>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{viewingEvent.title}</h2>
              </div>
              <button
                onClick={() => setViewingEvent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 shrink-0 mt-0.5"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {viewingEvent.date && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
                  <p className="text-sm text-gray-800">{formatDateLabel(viewingEvent.date)}</p>
                </div>
              )}
              {(viewingEvent.start_time || viewingEvent.end_time) && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Time</p>
                  <p className="text-sm text-gray-800">
                    {viewingEvent.start_time && formatTime(viewingEvent.start_time)}
                    {viewingEvent.end_time && ` – ${formatTime(viewingEvent.end_time)}`}
                  </p>
                </div>
              )}
              {viewingEvent.client && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Client</p>
                  <p className="text-sm text-gray-800">{viewingEvent.client}</p>
                </div>
              )}
              {viewingEvent.location && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
                  <p className="text-sm text-gray-800">{viewingEvent.location}</p>
                </div>
              )}
              {viewingEvent.assigned_to && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Assigned to</p>
                  <p className="text-sm text-gray-800">{viewingEvent.assigned_to}</p>
                </div>
              )}
              {viewingEvent.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewingEvent.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link to schedule picker */}
      {linkingTarget && (
        <JobEventPicker
          events={events}
          baseDate={linkingTarget.date}
          weekOffset={linkWeekOffset}
          onPrev={() => setLinkWeekOffset((o) => o - 1)}
          onNext={() => setLinkWeekOffset((o) => o + 1)}
          onSelect={(ev) => { handleAdminLink(ev); }}
          onClose={() => setLinkingTarget(null)}
        />
      )}
    </div>
  );
}
