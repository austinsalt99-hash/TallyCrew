// Shared hours aggregation for the admin Payroll page and the Financials
// page — both need "hours worked per employee over a date range, broken
// down by log type and by job", just over different ranges (a pay period
// vs. a calendar year). Kept here once so the old-format/new-format
// billable entry handling (see BillableEntry's dual format in CLAUDE.md)
// only needs to be right in one place.
//
// Paid time per day: clock in → clock out when the employee clocked in; when they didn't (common when the whole day was on one site),
// their job + non-billable hours for that day instead.
import { SupabaseClient } from "@supabase/supabase-js";
import { collectEntryHours, timeRangeHours, type RawHourEntry } from "@/lib/billableHours";

interface TypeInfo {
  name: string;
  timeMode: "job" | "day" | "none";
}

export interface JobBucket {
  jobKey: string;
  title: string;
  hours: number;
}

export interface TypeBucket {
  slug: string;
  typeName: string;
  hours: number;
}

export interface EmployeeHoursSummary {
  userId: string;
  employeeName: string;
  billableHours: number;
  nonBillableHours: number;
  // Paid hours (see the rule at the top of this file)
  totalHours: number;
  byType: TypeBucket[];
  byJob: JobBucket[];
}

interface EmployeeAgg {
  userId: string;
  employeeName: string;
  billableHours: number;
  nonBillableHours: number;
  paidHours: number;
  byType: Map<string, TypeBucket>;
  byJob: Map<string, JobBucket>;
}

function addHours(agg: EmployeeAgg, raw: RawHourEntry, typeName: string, jobKey: string, jobTitle: string) {
  if (raw.hours <= 0) return;
  agg.billableHours += raw.hours;

  const typeBucket = agg.byType.get(raw.slug) ?? { slug: raw.slug, typeName, hours: 0 };
  typeBucket.hours += raw.hours;
  agg.byType.set(raw.slug, typeBucket);

  const jobBucket = agg.byJob.get(jobKey) ?? { jobKey, title: jobTitle, hours: 0 };
  jobBucket.hours += raw.hours;
  agg.byJob.set(jobKey, jobBucket);
}

// Old-format entries (entryType + _typeData snapshots) predate the tab-strip
// redesign and aren't concurrent sub-jobs, so hours are additive as before —
// the carve-out only applies to the new subEntries format.
function collectOldFormatHours(entry: Record<string, unknown>): RawHourEntry[] {
  const result: RawHourEntry[] = [];
  const parentHours = timeRangeHours(entry.startTime as string | undefined, entry.endTime as string | undefined, entry.manualHours as number | undefined);
  const parentCustomFields = (entry.customFields as Record<string, string>) ?? {};
  const activeSlug = (entry.entryType as string) || "standard";

  if (parentHours > 0 || Object.values(parentCustomFields).some(Boolean)) {
    result.push({ slug: activeSlug, hours: parentHours, customFields: parentCustomFields });
  }

  const typeData = (entry._typeData as Record<string, Record<string, unknown>> | undefined) ?? {};
  for (const [slug, snapshot] of Object.entries(typeData)) {
    if (slug === activeSlug) continue;
    const hours = timeRangeHours(snapshot.startTime as string | undefined, snapshot.endTime as string | undefined, snapshot.manualHours as number | undefined);
    const customFields = (snapshot.customFields as Record<string, string>) ?? {};
    if (hours > 0 || Object.values(customFields).some(Boolean)) {
      result.push({ slug, hours, customFields });
    }
  }

  return result;
}

export async function aggregateEmployeeHours(
  supabase: SupabaseClient<any>,
  companyId: string,
  start: string,
  end: string
): Promise<EmployeeHoursSummary[]> {
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, user_id, employee_name, date, day_start_time, day_end_time, billable_entries, non_billable_entries")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .gte("date", start)
    .lte("date", end);

  const { data: rawTypes } = await supabase
    .from("log_entry_types")
    .select("slug, name, time_mode")
    .eq("company_id", companyId);
  const slugToType: Record<string, TypeInfo> = {};
  for (const t of rawTypes ?? []) {
    slugToType[t.slug] = { name: t.name, timeMode: (t.time_mode as "job" | "day" | "none") ?? "job" };
  }
  slugToType.standard = slugToType.standard ?? { name: "General", timeMode: "job" };
  const isTimedType = (slug: string) => !slugToType[slug] || slugToType[slug].timeMode !== "none";
  const typeName = (slug: string) => slugToType[slug]?.name ?? (slug === "standard" ? "General" : slug);

  const employees = new Map<string, EmployeeAgg>();

  for (const sub of submissions ?? []) {
    const userId = sub.user_id as string;
    if (!userId) continue;
    const agg = employees.get(userId) ?? {
      userId,
      employeeName: sub.employee_name as string,
      billableHours: 0,
      nonBillableHours: 0,
      paidHours: 0,
      byType: new Map(),
      byJob: new Map(),
    };
    employees.set(userId, agg);
    const jobHoursBefore = agg.billableHours + agg.nonBillableHours;

    const billableEntries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
    for (const entry of billableEntries) {
      const jobKey = (entry.linkedEventId as string) || (entry.client as string) || "unlinked";
      const jobTitle = (entry.linkedEventTitle as string) || (entry.client as string) || "General work";

      const rawHours = entry.subEntries != null
        ? collectEntryHours(
            {
              startTime: entry.startTime as string | undefined,
              endTime: entry.endTime as string | undefined,
              manualHours: entry.manualHours as number | undefined,
              customFields: (entry.customFields as Record<string, string>) ?? {},
              subEntries: ((entry.subEntries as Record<string, unknown>[]) ?? []).map((se) => ({
                slug: se.slug as string,
                startTime: se.startTime as string | undefined,
                endTime: se.endTime as string | undefined,
                manualHours: se.manualHours as number | undefined,
                customFields: (se.customFields as Record<string, string>) ?? {},
              })),
            },
            isTimedType
          )
        : collectOldFormatHours(entry);

      for (const rh of rawHours) {
        addHours(agg, rh, typeName(rh.slug), jobKey, jobTitle);
      }
    }

    const nonBillableEntries = (sub.non_billable_entries as { description: string; hours: string }[]) ?? [];
    const nbHours = nonBillableEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    agg.nonBillableHours += nbHours;

    const dayJobHours = agg.billableHours + agg.nonBillableHours - jobHoursBefore;
    const clockedHours = timeRangeHours(sub.day_start_time as string | undefined, sub.day_end_time as string | undefined);
    agg.paidHours += clockedHours > 0 ? clockedHours : dayJobHours;
  }

  return [...employees.values()]
    .map((agg) => {
      const totalHours = Math.round(agg.paidHours * 100) / 100;
      const byType = [...agg.byType.values()].sort((a, b) => b.hours - a.hours);
      if (agg.nonBillableHours > 0) byType.push({ slug: "non-billable", typeName: "Non-billable", hours: agg.nonBillableHours });
      const byJob = [...agg.byJob.values()].sort((a, b) => b.hours - a.hours);
      if (agg.nonBillableHours > 0) byJob.push({ jobKey: "non-billable", title: "Non-billable", hours: agg.nonBillableHours });
      // Clocked time that doesn't match the logged job time, so each breakdown
      // still adds up to the paid total
      const diff = Math.round((totalHours - agg.billableHours - agg.nonBillableHours) * 100) / 100;
      if (Math.abs(diff) >= 0.01) {
        const label = diff > 0 ? "Clocked time not logged to a job" : "Job time beyond clock in/out (not paid)";
        byType.push({ slug: "clock-difference", typeName: label, hours: diff });
        byJob.push({ jobKey: "clock-difference", title: label, hours: diff });
      }

      return {
        userId: agg.userId,
        employeeName: agg.employeeName,
        billableHours: Math.round(agg.billableHours * 100) / 100,
        nonBillableHours: Math.round(agg.nonBillableHours * 100) / 100,
        totalHours,
        byType,
        byJob,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}
