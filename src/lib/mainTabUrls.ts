import { fmt, getMonthDays, mondayOf } from "@/lib/calendarRanges";

// The data requests each bottom-nav tab makes when it opens. The tabs and the background
// warm-up (src/components/OfflinePreload.tsx) both build their URLs here, so the warm-up
// fills exactly the cache entries the tabs will read.

function thisWeek(now: Date) {
  const monday = mondayOf(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: fmt(monday), to: fmt(sunday) };
}

// --- Employee tabs ---

export function employeeDashboardUrls(now: Date = new Date()): string[] {
  const today = fmt(now);
  const week = thisWeek(now);
  return [
    `/api/events?from=${today}&to=${today}`,
    `/api/submissions/employee?from=${week.from}&to=${week.to}`,
    "/api/announcements",
    "/api/reminders",
    "/api/company",
  ];
}

// The week strip on the Hours tab, for the week containing `date` (YYYY-MM-DD) plus `weekOffset` weeks.
export function weekSubmissionsUrl(date: string, weekOffset = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const monday = mondayOf(new Date(y, mo - 1, d), weekOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `/api/submissions/employee?from=${fmt(monday)}&to=${fmt(sunday)}`;
}

export const LOG_CONFIG_URL = "/api/log-config";

export function eventsUrl(from: string, to: string): string {
  return `/api/events?from=${from}&to=${to}`;
}

// The schedule's wide prefetch: previous, current and next month.
export function scheduleWideEventsUrl(now: Date = new Date()): string {
  const next = getMonthDays(1, now);
  return eventsUrl(fmt(getMonthDays(-1, now)[0]), fmt(next[next.length - 1]));
}

function employeeTabUrls(now: Date): string[] {
  const week = thisWeek(now);
  return [
    ...employeeDashboardUrls(now),
    LOG_CONFIG_URL,
    weekSubmissionsUrl(fmt(now)),
    "/api/me",
    scheduleWideEventsUrl(now),
    eventsUrl(week.from, week.to),
  ];
}

// --- Admin tabs ---

export const ADMIN_HOME_URLS = ["/api/announcements", "/api/reminders", "/api/admin/workers", "/api/company"];

// Logs tab: submissions for the last `days` days up to today, or everything when null.
export function adminSubmissionsUrl(days: number | null, now: Date = new Date()): string {
  const to = fmt(now);
  if (days === null) return `/api/submissions?to=${to}`;
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  return `/api/submissions?from=${fmt(start)}&to=${to}`;
}

export const ADMIN_LOGS_INITIAL_DAYS = 30;

export function planEventsUrl(from: string, to: string): string {
  return `/api/admin/plan-events?from=${from}&to=${to}`;
}

function adminTabUrls(now: Date): string[] {
  const week = thisWeek(now);
  return [
    ...ADMIN_HOME_URLS,
    adminSubmissionsUrl(ADMIN_LOGS_INITIAL_DAYS, now),
    "/api/events",
    "/api/availability",
    eventsUrl(week.from, week.to),
    "/api/events?unverified=1",
    planEventsUrl(week.from, week.to),
    "/api/ongoing-jobs",
    LOG_CONFIG_URL,
    weekSubmissionsUrl(fmt(now)),
  ];
}

export function mainTabUrls(role: "admin" | "worker", now: Date = new Date()): string[] {
  return [...new Set(role === "admin" ? adminTabUrls(now) : employeeTabUrls(now))];
}
