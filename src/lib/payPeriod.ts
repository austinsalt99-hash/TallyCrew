// Date-only math for pay period boundaries. Dates are plain YYYY-MM-DD
// strings (no timezone conversion) to match how dates are handled
// elsewhere in the app (see TimesheetForm's fmtDate/today helpers).

export type PayPeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface PayPeriod {
  start: string;
  end: string;
}

function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Whole-day difference between two local dates. Diffing via getTime() and
// dividing by 86400000 breaks across DST transitions (a 23- or 25-hour local
// day throws off the day count) — going through Date.UTC() with the same
// y/m/d fields sidesteps DST entirely since UTC has no DST.
function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86400000);
}

export function today(): string {
  return toStr(new Date());
}

// Returns the period that contains referenceDate for the given schedule.
export function getPeriodFor(type: PayPeriodType, anchor: string, referenceDate: string): PayPeriod {
  const ref = toDate(referenceDate);

  if (type === "semimonthly") {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    if (ref.getDate() <= 15) {
      return { start: toStr(new Date(y, m, 1)), end: toStr(new Date(y, m, 15)) };
    }
    return { start: toStr(new Date(y, m, 16)), end: toStr(new Date(y, m, lastDayOfMonth(y, m))) };
  }

  if (type === "monthly") {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    return { start: toStr(new Date(y, m, 1)), end: toStr(new Date(y, m, lastDayOfMonth(y, m))) };
  }

  // weekly / biweekly: fixed-length blocks anchored to a known start date
  const lengthDays = type === "weekly" ? 7 : 14;
  const anchorDate = toDate(anchor);
  const diffDays = daysBetween(ref, anchorDate);
  const periodsSinceAnchor = Math.floor(diffDays / lengthDays);
  const start = addDays(anchorDate, periodsSinceAnchor * lengthDays);
  return { start: toStr(start), end: toStr(addDays(start, lengthDays - 1)) };
}

export function getCurrentPeriod(type: PayPeriodType, anchor: string): PayPeriod {
  return getPeriodFor(type, anchor, today());
}

export function getAdjacentPeriod(period: PayPeriod, type: PayPeriodType, anchor: string, direction: 1 | -1): PayPeriod {
  if (type === "semimonthly" || type === "monthly") {
    const probeDate = direction === 1 ? addDays(toDate(period.end), 1) : addDays(toDate(period.start), -1);
    return getPeriodFor(type, anchor, toStr(probeDate));
  }
  const lengthDays = type === "weekly" ? 7 : 14;
  const newStart = addDays(toDate(period.start), direction * lengthDays);
  return getPeriodFor(type, anchor, toStr(newStart));
}

export function formatPeriodLabel(period: PayPeriod): string {
  const s = toDate(period.start);
  const e = toDate(period.end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  const endLabel = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}
