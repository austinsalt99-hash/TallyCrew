"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAVY = "#0A1172";
const NAVY_DARK = "#060b47";
const ORANGE = "#F4A823";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildTimeOptions(): { label: string; value: string }[] {
  const opts: { label: string; value: string }[] = [];
  for (let h = 5; h <= 23; h++) {
    const hh = String(h).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    opts.push({ label: `${h12}:00 ${ampm}`, value: `${hh}:00` });
  }
  return opts;
}

const TIME_OPTIONS = buildTimeOptions();

function fmt12(time: string): string {
  const [h] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12} ${ampm}`;
}

function fmtDays(days: number[]): string {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_FULL[d])
    .join(", ");
}

function fmtSchedule(r: Reminder): string {
  if (r.one_off_date) {
    const [y, mo, d] = r.one_off_date.split("-").map(Number);
    return `Once · ${new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return fmtDays(r.days_of_week ?? []);
}

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
}

interface Reminder {
  id: string;
  title: string;
  body: string | null;
  target_type: "all" | "specific";
  target_user_ids: string[] | null;
  send_time: string;
  days_of_week: number[] | null;
  one_off_date: string | null;
  active: boolean;
  created_at: string;
}

interface Worker {
  id: string;
  full_name: string;
}

function greet(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `Good ${part}, ${name.split(" ")[0]}`;
}

export default function AdminDashboardView({ userName }: { userName: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false);
  const [remindersExpanded, setRemindersExpanded] = useState(false);

  // Announcement form
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPinned, setAnnPinned] = useState(false);
  const [annSaving, setAnnSaving] = useState(false);

  // Reminder form
  const [showRemForm, setShowRemForm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [remTitle, setRemTitle] = useState("");
  const [remBody, setRemBody] = useState("");
  const [remTargetType, setRemTargetType] = useState<"all" | "specific">("all");
  const [remTargetIds, setRemTargetIds] = useState<string[]>([]);
  const [remTime, setRemTime] = useState("08:00");
  const [remFrequency, setRemFrequency] = useState<"recurring" | "one_off">("recurring");
  const [remDays, setRemDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [remOneOffDate, setRemOneOffDate] = useState("");
  const [remSaving, setRemSaving] = useState(false);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/announcements").then((r) => r.json()),
      fetch("/api/reminders").then((r) => r.json()),
      fetch("/api/admin/workers").then((r) => r.json()),
      fetch("/api/company", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([annData, remData, wrkData, companyData]) => {
        setAnnouncements(Array.isArray(annData) ? annData : []);
        setReminders(Array.isArray(remData) ? remData : []);
        setWorkers(Array.isArray(wrkData) ? wrkData.filter((w: Worker & { role: string }) => w.role === "worker") : []);
        setBannerUrl(companyData?.banner_url ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // --- Announcement handlers ---
  async function handlePostAnn() {
    if (!annTitle.trim()) return;
    setAnnSaving(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: annTitle.trim(), body: annBody.trim() || null, pinned: annPinned }),
      });
      if (!res.ok) return;
      const created: Announcement = await res.json();
      setAnnouncements((prev) => [created, ...prev]);
      setAnnTitle(""); setAnnBody(""); setAnnPinned(false); setShowAnnForm(false);
    } finally {
      setAnnSaving(false);
    }
  }

  async function handleDeleteAnn(id: string) {
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }
  }

  // --- Reminder handlers ---
  function toggleDay(dow: number) {
    setRemDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  }

  function toggleTargetId(id: string) {
    setRemTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function resetReminderForm() {
    setEditingReminderId(null);
    setRemTitle(""); setRemBody(""); setRemTargetType("all"); setRemTargetIds([]);
    setRemTime("08:00"); setRemFrequency("recurring"); setRemDays([1, 2, 3, 4, 5]); setRemOneOffDate("");
  }

  function openNewReminderForm() {
    resetReminderForm();
    setShowRemForm(true);
  }

  function openEditReminderForm(r: Reminder) {
    setEditingReminderId(r.id);
    setRemTitle(r.title);
    setRemBody(r.body ?? "");
    setRemTargetType(r.target_type);
    setRemTargetIds(r.target_user_ids ?? []);
    setRemTime(r.send_time);
    if (r.one_off_date) {
      setRemFrequency("one_off");
      setRemOneOffDate(r.one_off_date);
      setRemDays([1, 2, 3, 4, 5]);
    } else {
      setRemFrequency("recurring");
      setRemDays(r.days_of_week ?? [1, 2, 3, 4, 5]);
      setRemOneOffDate("");
    }
    setShowRemForm(true);
  }

  async function handleSaveReminder() {
    if (!remTitle.trim()) return;
    if (remFrequency === "recurring" && !remDays.length) return;
    if (remFrequency === "one_off" && !remOneOffDate) return;
    if (remTargetType === "specific" && !remTargetIds.length) return;
    setRemSaving(true);
    try {
      const payload = {
        title: remTitle.trim(),
        body: remBody.trim() || null,
        target_type: remTargetType,
        target_user_ids: remTargetType === "specific" ? remTargetIds : null,
        send_time: remTime,
        days_of_week: remFrequency === "recurring" ? remDays : null,
        one_off_date: remFrequency === "one_off" ? remOneOffDate : null,
      };
      const res = await fetch(editingReminderId ? `/api/reminders/${editingReminderId}` : "/api/reminders", {
        method: editingReminderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const saved: Reminder = await res.json();
      setReminders((prev) =>
        editingReminderId ? prev.map((r) => (r.id === editingReminderId ? saved : r)) : [saved, ...prev]
      );
      resetReminderForm();
      setShowRemForm(false);
    } finally {
      setRemSaving(false);
    }
  }

  async function handleToggleReminder(id: string, active: boolean) {
    const res = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, active } : r));
    }
  }

  async function handleDeleteReminder(id: string) {
    const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
    }
  }

  return (
    <div>

      {/* Header */}
      <div
        className="px-5 pt-14 md:pt-8 pb-20 relative overflow-hidden"
        style={{
          ...(bannerUrl
            ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: `linear-gradient(155deg, ${NAVY_DARK} 0%, ${ORANGE} 100%)` }),
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginTop: "-2rem",
        }}
      >
        {bannerUrl && (
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,17,114,0.55) 0%, rgba(10,17,114,0.35) 100%)" }} />
        )}
        <div className="relative z-10">
          <p className="text-sm text-white/70 font-medium tracking-wide">{todayLabel}</p>
          <h1 className="text-[26px] font-bold text-white mt-1 leading-tight">{greet(userName)}</h1>
        </div>
      </div>

      {/* Quick access card */}
      <div className="mt-4 bg-white rounded-2xl shadow-xl p-4 relative z-10">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/dashboard"
            className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-2.5 active:bg-gray-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Employee Logs</p>
              <p className="text-xs text-gray-400 mt-0.5">Review submissions</p>
            </div>
          </Link>

          <Link
            href="/admin/calendar"
            className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-2.5 active:bg-gray-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 bg-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Calendar</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage job schedule</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="space-y-5 mt-5">

        {/* Announcements */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Announcements</h2>
            <button
              onClick={() => setShowAnnForm((v) => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: showAnnForm ? "#f3f4f6" : NAVY,
                color: showAnnForm ? "#374151" : "#fff",
              }}
            >
              {showAnnForm ? "Cancel" : "+ New"}
            </button>
          </div>

          {showAnnForm && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-3 space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
              />
              <textarea
                placeholder="Body (optional)"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setAnnPinned((v) => !v)}
                    className="w-9 h-5 rounded-full transition-colors relative"
                    style={{ backgroundColor: annPinned ? ORANGE : "#d1d5db" }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{ transform: annPinned ? "translateX(18px)" : "translateX(2px)" }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Pin to top</span>
                </label>
                <button
                  onClick={handlePostAnn}
                  disabled={annSaving || !annTitle.trim()}
                  className="text-sm font-semibold px-4 py-2.5 md:py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: NAVY }}
                >
                  {annSaving ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
              <p className="text-sm font-semibold text-gray-700">No announcements yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Post one to notify your team</p>
            </div>
          ) : (
            <>
              <div className={announcementsExpanded ? "space-y-2 max-h-96 overflow-y-auto pr-0.5" : "space-y-2"}>
                {(announcementsExpanded ? announcements : announcements.slice(0, 3)).map((a) => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {a.pinned && <div className="h-0.5" style={{ backgroundColor: ORANGE }} />}
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {a.pinned && (
                          <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: ORANGE }}>
                            Pinned
                          </span>
                        )}
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{a.title}</p>
                        {a.body && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.body}</p>}
                        <p className="text-[10px] text-gray-300 mt-2">
                          {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnn(a.id)}
                        className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {announcements.length > 3 && (
                <button
                  onClick={() => setAnnouncementsExpanded((v) => !v)}
                  className="w-full flex items-center justify-center gap-1 mt-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  {announcementsExpanded ? "Show less" : `Show ${announcements.length - 3} more`}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${announcementsExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </>
          )}
        </section>

        {/* Reminders */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reminders</h2>
            <button
              onClick={() => {
                if (showRemForm) {
                  setShowRemForm(false);
                  resetReminderForm();
                } else {
                  openNewReminderForm();
                }
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: showRemForm ? "#f3f4f6" : NAVY,
                color: showRemForm ? "#374151" : "#fff",
              }}
            >
              {showRemForm ? "Cancel" : "+ New"}
            </button>
          </div>

          {showRemForm && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-3 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                {editingReminderId ? "Edit reminder" : "New reminder"}
              </p>
              <input
                type="text"
                placeholder="Title"
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
              />
              <textarea
                placeholder="Body (optional)"
                value={remBody}
                onChange={(e) => setRemBody(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
              />

              {/* Target */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Send to</p>
                <div className="flex gap-2">
                  {(["all", "specific"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setRemTargetType(t); setRemTargetIds([]); }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                      style={remTargetType === t
                        ? { backgroundColor: NAVY, color: "#fff", borderColor: NAVY }
                        : { backgroundColor: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }
                      }
                    >
                      {t === "all" ? "Everyone" : "Specific employee"}
                    </button>
                  ))}
                </div>
              </div>

              {remTargetType === "specific" && workers.length > 0 && (
                <div className="space-y-1.5">
                  {workers.map((w) => (
                    <label key={w.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={remTargetIds.includes(w.id)}
                        onChange={() => toggleTargetId(w.id)}
                        className="w-4 h-4 rounded accent-navy"
                        style={{ accentColor: NAVY }}
                      />
                      <span className="text-sm text-gray-700">{w.full_name}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Frequency */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Frequency</p>
                <div className="flex gap-2">
                  {(["recurring", "one_off"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setRemFrequency(f)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                      style={remFrequency === f
                        ? { backgroundColor: NAVY, color: "#fff", borderColor: NAVY }
                        : { backgroundColor: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }
                      }
                    >
                      {f === "recurring" ? "Repeats" : "One time"}
                    </button>
                  ))}
                </div>
              </div>

              {remFrequency === "recurring" ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Days</p>
                  <div className="flex gap-1.5">
                    {DAY_LABELS.map((label, dow) => (
                      <button
                        key={dow}
                        onClick={() => toggleDay(dow)}
                        className="w-8 h-8 rounded-lg text-xs font-bold border transition-colors"
                        style={remDays.includes(dow)
                          ? { backgroundColor: NAVY, color: "#fff", borderColor: NAVY }
                          : { backgroundColor: "#f9fafb", color: "#9ca3af", borderColor: "#e5e7eb" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Date</p>
                  <input
                    type="date"
                    value={remOneOffDate}
                    onChange={(e) => setRemOneOffDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
                  />
                </div>
              )}

              {/* Time */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Time</p>
                <select
                  value={remTime}
                  onChange={(e) => setRemTime(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                  style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
                >
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveReminder}
                  disabled={
                    remSaving ||
                    !remTitle.trim() ||
                    (remFrequency === "recurring" ? !remDays.length : !remOneOffDate) ||
                    (remTargetType === "specific" && !remTargetIds.length)
                  }
                  className="text-sm font-semibold px-4 py-2.5 md:py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: NAVY }}
                >
                  {remSaving ? "Saving…" : editingReminderId ? "Save changes" : "Save"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
              <p className="text-sm font-semibold text-gray-700">No reminders yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Create one to schedule timed notifications</p>
            </div>
          ) : (
            <>
              <div className={remindersExpanded ? "space-y-2 max-h-96 overflow-y-auto pr-0.5" : "space-y-2"}>
                {(remindersExpanded ? reminders : reminders.slice(0, 3)).map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                    style={{ opacity: r.active ? 1 : 0.5 }}
                  >
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{r.title}</p>
                        {r.body && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.body}</p>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${NAVY}15`, color: NAVY }}>
                            {fmt12(r.send_time)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{fmtSchedule(r)}</span>
                          <span className="text-[10px] text-gray-400">
                            {r.target_type === "all" ? "Everyone" : `${r.target_user_ids?.length ?? 0} employee${(r.target_user_ids?.length ?? 0) !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit */}
                        <button
                          onClick={() => openEditReminderForm(r)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-navy-600 hover:bg-gray-50 transition-colors"
                          title="Edit reminder"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {/* Active toggle */}
                        <button
                          onClick={() => handleToggleReminder(r.id, !r.active)}
                          className="w-8 h-5 rounded-full relative transition-colors"
                          style={{ backgroundColor: r.active ? ORANGE : "#d1d5db" }}
                          title={r.active ? "Pause reminder" : "Enable reminder"}
                        >
                          <div
                            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                            style={{ transform: r.active ? "translateX(14px)" : "translateX(2px)" }}
                          />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteReminder(r.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {reminders.length > 3 && (
                <button
                  onClick={() => setRemindersExpanded((v) => !v)}
                  className="w-full flex items-center justify-center gap-1 mt-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  {remindersExpanded ? "Show less" : `Show ${reminders.length - 3} more`}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${remindersExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </>
          )}
        </section>

      </div>
    </div>
  );
}
