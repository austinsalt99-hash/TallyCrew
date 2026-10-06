import { fmt, getMonthDays, mondayOf } from "@/lib/calendarRanges";

// Each request goes through the service worker, which stores the response in the
// api-cache. Offline, the screens read from that cache. Responses are overwritten
// when the same URL is fetched again, so the cache holds one copy per URL and does
// not grow with time.

const LAST_RUN_KEY = "tallycrew-offline-preload-at";
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WEEKS_BACK = 4; // this week plus the four before it, about a month

// Same URLs the screens request, so the cached responses match.
export function buildPreloadUrls(now: Date = new Date()): string[] {
  const urls = ["/api/me", "/api/log-config", `/api/submissions/employee?date=${fmt(now)}`];

  // Monday-to-Sunday weeks: timesheet and dashboard use submissions, the schedule uses events.
  for (let w = 0; w <= WEEKS_BACK; w++) {
    const monday = mondayOf(now, -w);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const range = `from=${fmt(monday)}&to=${fmt(sunday)}`;
    urls.push(`/api/submissions/employee?${range}`, `/api/events?${range}`);
  }

  // The schedule's own month views: the wide prefetch, and this month's grid.
  const wideDays = getMonthDays(1, now);
  urls.push(`/api/events?from=${fmt(getMonthDays(-1, now)[0])}&to=${fmt(wideDays[wideDays.length - 1])}`);
  const thisMonth = getMonthDays(0, now);
  urls.push(`/api/events?from=${fmt(thisMonth[0])}&to=${fmt(thisMonth[thisMonth.length - 1])}`);

  return [...new Set(urls)];
}

function isDue(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(LAST_RUN_KEY) ?? 0) > MIN_INTERVAL_MS;
  } catch {
    // Storage unavailable (private browsing, etc.): run and skip the throttle.
    return true;
  }
}

let running = false;

// Quietly fetches the employee screens' data so it's cached for offline use.
// Does nothing when offline, signed out, admin, or when it ran in the last six hours.
export async function preloadOfflineData(): Promise<void> {
  if (running || !navigator.onLine || !isDue()) return;
  running = true;
  try {
    const me = await fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!me || me.role === "admin") return;

    for (const url of buildPreloadUrls()) {
      if (!navigator.onLine) return; // try again on the next run
      const res = await fetch(url, { credentials: "include" }).catch(() => null);
      if (!res) return;
      await res.text(); // read the body so the service worker finishes storing it
    }

    try {
      localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    } catch {
      // Without storage the next run just happens sooner.
    }
  } finally {
    running = false;
  }
}

// Call on sign-out, so the next person to sign in on this device can't see the previous person's cached data.
export async function clearOfflineCache(): Promise<void> {
  try {
    localStorage.removeItem(LAST_RUN_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(names.filter((n) => /api-cache|pages-cache/.test(n)).map((n) => caches.delete(n)));
}
