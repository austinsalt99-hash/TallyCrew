// Shared date-string (YYYY-MM-DD) math, used wherever we need to shift or
// diff calendar dates without timezone conversion.

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

// Whole-day difference (a - b). Diffing via getTime()/86400000 breaks across
// DST transitions (a 23- or 25-hour local day throws off the count) — going
// through Date.UTC() with the same y/m/d fields sidesteps DST entirely.
export function daysBetweenDateStrs(a: string, b: string): number {
  const da = parseDateStr(a);
  const db = parseDateStr(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcA - utcB) / 86400000);
}
