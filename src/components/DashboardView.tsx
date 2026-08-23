"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAVY = "#0A1172";
const NAVY_DARK = "#060b47";
const ORANGE = "#F4A823";
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHART_MAX_H = 36;

interface JobEvent {
  id: string;
  title: string;
  client: string;
  location: string;
  start_time: string;
  end_time: string;
}

interface DaySubmission {
  date: string;
  total_billable_hours: number;
  total_non_billable_hours: number;
  day_start_time?: string;
  day_end_time?: string;
  break_minutes?: number;
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
  send_time: string;
  days_of_week: number[] | null;
  one_off_date: string | null;
}

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
    return `Once · ${new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return fmtDays(r.days_of_week ?? []);
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function calcWorked(s: DaySubmission): number {
  if (s.day_start_time && s.day_end_time) {
    const [sh, sm] = s.day_start_time.split(":").map(Number);
    const [eh, em] = s.day_end_time.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm) - (s.break_minutes ?? 0);
    return Math.max(mins / 60, 0);
  }
  return (s.total_billable_hours || 0) + (s.total_non_billable_hours || 0);
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function greet(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `Good ${part}, ${name.split(" ")[0]}`;
}

function barFill(dayStr: string, todayStr: string, hours: number): string {
  if (dayStr === todayStr) return hours > 0 ? ORANGE : "#fde8bb";
  if (dayStr < todayStr) return hours > 0 ? NAVY : "#d5d9ff";
  return "#e5e7eb";
}

export default function DashboardView({ userName }: { userName: string }) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [submissions, setSubmissions] = useState<DaySubmission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false);
  const [remindersExpanded, setRemindersExpanded] = useState(false);

  const weekDays = getWeekDays();
  const todayStr = fmtDate(new Date());
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const weekFrom = fmtDate(weekDays[0]);
  const weekTo = fmtDate(weekDays[6]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/events?from=${todayStr}&to=${todayStr}`).then((r) => r.json()),
      fetch(`/api/submissions/employee?from=${weekFrom}&to=${weekTo}`, { credentials: "include" }).then((r) => r.json()),
      fetch("/api/announcements").then((r) => r.json()),
      fetch("/api/reminders").then((r) => r.json()),
      fetch("/api/company", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([evData, subData, annData, remData, companyData]) => {
        setEvents(Array.isArray(evData) ? evData : []);
        setSubmissions(Array.isArray(subData) ? subData : []);
        setAnnouncements(Array.isArray(annData) ? annData : []);
        setReminders(Array.isArray(remData) ? remData : []);
        setBannerUrl(companyData?.banner_url ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todayStr, weekFrom, weekTo]);

  const totalWorked = Math.round(submissions.reduce((s, d) => s + calcWorked(d), 0) * 10) / 10;
  const totalBillable = Math.round(submissions.reduce((s, d) => s + (d.total_billable_hours || 0), 0) * 10) / 10;
  const totalNonBillable = Math.round(submissions.reduce((s, d) => s + (d.total_non_billable_hours || 0), 0) * 10) / 10;
  const daysLogged = submissions.length;

  const subByDate = Object.fromEntries(submissions.map((s) => [s.date, s]));
  const dayHours = weekDays.map((d) => {
    const sub = subByDate[fmtDate(d)];
    return sub ? Math.round(calcWorked(sub) * 10) / 10 : 0;
  });
  const maxH = Math.max(...dayHours, 1);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header — banner image or gradient fallback */}
      <div
        className="px-5 pt-14 pb-20 relative overflow-hidden"
        style={bannerUrl
          ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: `linear-gradient(155deg, ${NAVY_DARK} 0%, ${ORANGE} 100%)` }
        }
      >
        {bannerUrl && (
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,17,114,0.55) 0%, rgba(10,17,114,0.35) 100%)" }} />
        )}
        <div className="relative z-10">
          <p className="text-sm text-white/70 font-medium tracking-wide">{todayLabel}</p>
          <h1 className="text-[26px] font-bold text-white mt-1 leading-tight">{greet(userName)}</h1>
        </div>
      </div>

      {/* Week summary card — sits below header with small gap so banner is visible */}
      <div className="mt-4 mx-4 bg-white rounded-2xl shadow-xl p-4 relative z-10">

        {/* Total + days */}
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : `${totalWorked}h`}
            </span>
            <span className="text-sm text-gray-400 font-medium">this week</span>
          </div>
          <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
            {daysLogged} day{daysLogged !== 1 ? "s" : ""} logged
          </span>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {weekDays.map((day, i) => {
            const dayStr = fmtDate(day);
            const hours = dayHours[i];
            const isToday = dayStr === todayStr;
            const barH = hours > 0
              ? Math.max((hours / maxH) * CHART_MAX_H, 8)
              : isToday ? 6 : 4;

            return (
              <div key={dayStr} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{ height: barH, backgroundColor: barFill(dayStr, todayStr, hours) }}
                />
                <span
                  className="text-[10px] font-bold leading-none"
                  style={{ color: isToday ? ORANGE : "#9ca3af" }}
                >
                  {DAY_LETTERS[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Billable split — only shown when there's data */}
        {!loading && (totalBillable > 0 || totalNonBillable > 0) && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-navy-500 shrink-0" />
              <span className="text-xs text-gray-500">{totalBillable}h billable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
              <span className="text-xs text-gray-500">{totalNonBillable}h non-billable</span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div
        className="px-4 mt-5 space-y-5"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >

        {/* Announcements */}
        {(loading || announcements.length > 0) && (
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Announcements</h2>
            {loading ? (
              <div className="space-y-2">
                <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            ) : (
              <>
                <div
                  className={announcementsExpanded ? "space-y-2 max-h-80 overflow-y-auto pr-0.5" : "space-y-2"}
                >
                  {(announcementsExpanded ? announcements : announcements.slice(0, 3)).map((a) => (
                    <div
                      key={a.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                    >
                      {a.pinned && (
                        <div className="h-0.5" style={{ backgroundColor: ORANGE }} />
                      )}
                      <div className="p-4">
                        {a.pinned && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider mb-1 block"
                            style={{ color: ORANGE }}
                          >
                            Pinned
                          </span>
                        )}
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{a.title}</p>
                        {a.body && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.body}</p>
                        )}
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
        )}

        {/* Reminders */}
        {(loading || reminders.length > 0) && (
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Reminders</h2>
            {loading ? (
              <div className="space-y-2">
                <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            ) : (
              <>
                <div
                  className={remindersExpanded ? "space-y-2 max-h-80 overflow-y-auto pr-0.5" : "space-y-2"}
                >
                  {(remindersExpanded ? reminders : reminders.slice(0, 3)).map((r) => (
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="h-0.5" style={{ backgroundColor: NAVY }} />
                      <div className="p-4">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{r.title}</p>
                        {r.body && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.body}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${NAVY}15`, color: NAVY }}>
                            {fmt12(r.send_time)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{fmtSchedule(r)}</span>
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
        )}

        {/* Today's Jobs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Today&apos;s Jobs</h2>
            <Link href="/schedule" className="text-xs font-semibold" style={{ color: ORANGE }}>
              Full schedule →
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-3">
              <div className="w-44 h-28 bg-gray-100 rounded-2xl animate-pulse shrink-0" />
              <div className="w-44 h-28 bg-gray-100 rounded-2xl animate-pulse shrink-0" />
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 py-7 text-center">
              <div className="flex justify-center mb-1.5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">No jobs scheduled today</p>
              <p className="text-xs text-gray-400 mt-0.5">Check the schedule for the week ahead</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-0.5 -mx-4 px-4">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="shrink-0 w-48 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
                >
                  <div className="h-1" style={{ backgroundColor: ORANGE }} />
                  <div className="p-3.5">
                    <p className="font-bold text-gray-900 text-sm leading-snug">{ev.title}</p>
                    {ev.client && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{ev.client}</p>
                    )}
                    {ev.start_time && (
                      <p className="text-xs font-semibold mt-2.5" style={{ color: ORANGE }}>
                        {formatTime(ev.start_time)}
                        {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                      </p>
                    )}
                    {ev.location && (
                      <p className="text-xs text-gray-400 mt-1 truncate flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z"/><circle cx="8" cy="6" r="1.5"/></svg>
                        {ev.location}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick access */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/"
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2.5 active:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-navy-50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A1172" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                  <path d="M16 2l4 4-8 8H8v-4l8-8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Log Hours</p>
                <p className="text-xs text-gray-400 mt-0.5">Submit today&apos;s timesheet</p>
              </div>
            </Link>

            <Link
              href="/schedule"
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2.5 active:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ORANGE}22` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Schedule</p>
                <p className="text-xs text-gray-400 mt-0.5">View the week ahead</p>
              </div>
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
