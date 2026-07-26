// Sub-entry time (e.g. "Machine Operating") is a carve-out of the General
// block's time, not additional time on top of it. An employee who clocks
// 8h General and logs 2h Machine Operating within that window worked 8h
// total, not 10 — General should display/bill for the remaining 6h.

export function timeRangeHours(start?: string, end?: string, manualHours?: number | null): number {
  if (manualHours != null) return manualHours;
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}

export function formatHoursLabel(hours: number): string {
  if (hours <= 0) return "";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface GeneralCarveOut {
  generalHours: number;
  subTotalHours: number;
  overflow: boolean;
}

export function carveOutGeneral(generalWindowHours: number, subHours: number[]): GeneralCarveOut {
  const subTotalHours = Math.round(subHours.reduce((s, h) => s + h, 0) * 100) / 100;
  if (generalWindowHours <= 0) return { generalHours: 0, subTotalHours, overflow: false };
  const overflow = subTotalHours > generalWindowHours + 0.001;
  const generalHours = Math.max(0, Math.round((generalWindowHours - subTotalHours) * 100) / 100);
  return { generalHours, subTotalHours, overflow };
}

export interface RawHourEntry {
  slug: string;
  hours: number;
  customFields: Record<string, string>;
}

interface CollectHoursSubEntry {
  slug: string;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
  customFields?: Record<string, string>;
}

interface CollectHoursEntry {
  startTime?: string;
  endTime?: string;
  manualHours?: number;
  customFields?: Record<string, string>;
  subEntries?: CollectHoursSubEntry[];
}

// Breaks a new-format billable entry into per-type hour buckets: one for
// General (carved out of the parent window) and one per sub-entry. A
// sub-entry with no time of its own defaults to the full parent window when
// its type is timed (e.g. "did Machine Operating the whole job") — matching
// how the type is configured, not zero.
export function collectEntryHours(entry: CollectHoursEntry, isTimedType: (slug: string) => boolean): RawHourEntry[] {
  const result: RawHourEntry[] = [];
  const parentHours = timeRangeHours(entry.startTime, entry.endTime, entry.manualHours);
  const parentCustomFields = entry.customFields ?? {};
  const subEntries = entry.subEntries ?? [];

  const subResults = subEntries.map((se) => {
    const ownHours = timeRangeHours(se.startTime, se.endTime, se.manualHours);
    const hours = ownHours > 0 ? ownHours : (isTimedType(se.slug) ? parentHours : 0);
    return { slug: se.slug, hours, customFields: se.customFields ?? {} };
  });

  const { generalHours } = carveOutGeneral(parentHours, subResults.map((r) => r.hours));
  const hasGeneralData = generalHours > 0 || Object.values(parentCustomFields).some(Boolean);
  if (hasGeneralData) result.push({ slug: "standard", hours: generalHours, customFields: parentCustomFields });
  result.push(...subResults);
  return result;
}

interface OverflowCheckSubEntry {
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

interface OverflowCheckEntry {
  startTime?: string;
  endTime?: string;
  manualHours?: number;
  subEntries?: OverflowCheckSubEntry[];
}

export interface BillableOverflowIssue {
  entryIndex: number;
  generalHours: number;
  subTotalHours: number;
}

// Flags the first billable entry whose sub-entries claim more hours than the
// General window they're supposed to be carved out of.
export function findBillableOverflow(entries: OverflowCheckEntry[]): BillableOverflowIssue | null {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const generalWindow = timeRangeHours(entry.startTime, entry.endTime, entry.manualHours);
    if (generalWindow <= 0) continue;
    const subHours = (entry.subEntries ?? []).map((s) => timeRangeHours(s.startTime, s.endTime, s.manualHours));
    const { overflow, subTotalHours } = carveOutGeneral(generalWindow, subHours);
    if (overflow) return { entryIndex: i, generalHours: generalWindow, subTotalHours };
  }
  return null;
}
