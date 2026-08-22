import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { collectEntryHours, timeRangeHours, type RawHourEntry } from "@/lib/billableHours";

type RangeKey = "month" | "quarter" | "ytd" | "all";

interface TypeInfo {
  name: string;
  timeMode: "job" | "day" | "none";
}

interface TypeBucket {
  slug: string;
  typeName: string;
  hours: number;
}

interface WorkerAgg {
  userId: string;
  employeeName: string;
  billableHours: number;
  nonBillableHours: number;
  byType: Map<string, TypeBucket>;
}

interface TrendBucket {
  periodStart: string;
  billableHours: number;
  nonBillableHours: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeToDates(range: RangeKey, now: Date): { start: string | null; end: string } {
  const end = toDateStr(now);
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toDateStr(start), end };
  }
  if (range === "quarter") {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { start: toDateStr(start), end };
  }
  if (range === "ytd") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start: toDateStr(start), end };
  }
  return { start: null, end };
}

// Buckets short ranges by week (Monday start) and long ranges by month, so the
// trend chart never has to render more than ~13 points regardless of range.
function bucketKey(dateStr: string, granularity: "week" | "month"): string {
  const d = new Date(dateStr + "T00:00:00");
  if (granularity === "month") {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  }
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toDateStr(d);
}

function addHours(agg: WorkerAgg, raw: RawHourEntry, typeName: string) {
  if (raw.hours <= 0) return;
  agg.billableHours += raw.hours;
  const bucket = agg.byType.get(raw.slug) ?? { slug: raw.slug, typeName, hours: 0 };
  bucket.hours += raw.hours;
  agg.byType.set(raw.slug, bucket);
}

// Mirrors collectOldFormatHours in /api/payroll — old-format entries predate
// the tab-strip redesign and aren't concurrent sub-jobs, so hours are additive.
function collectOldFormatHours(entry: Record<string, unknown>): RawHourEntry[] {
  const result: RawHourEntry[] = [];
  const parentHours = timeRangeHours(entry.startTime as string | undefined, entry.endTime as string | undefined, entry.manualHours as number | undefined);
  const activeSlug = (entry.entryType as string) || "standard";
  if (parentHours > 0) result.push({ slug: activeSlug, hours: parentHours, customFields: {} });

  const typeData = (entry._typeData as Record<string, Record<string, unknown>> | undefined) ?? {};
  for (const [slug, snapshot] of Object.entries(typeData)) {
    if (slug === activeSlug) continue;
    const hours = timeRangeHours(snapshot.startTime as string | undefined, snapshot.endTime as string | undefined, snapshot.manualHours as number | undefined);
    if (hours > 0) result.push({ slug, hours, customFields: {} });
  }
  return result;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rangeParam = req.nextUrl.searchParams.get("range");
  const range: RangeKey = rangeParam === "month" || rangeParam === "quarter" || rangeParam === "ytd" || rangeParam === "all" ? rangeParam : "month";
  const { start, end } = rangeToDates(range, new Date());
  const granularity: "week" | "month" = range === "month" || range === "quarter" ? "week" : "month";

  let query = supabase
    .from("submissions")
    .select("user_id, employee_name, date, billable_entries, non_billable_entries")
    .eq("company_id", profile.company_id)
    .lte("date", end);
  if (start) query = query.gte("date", start);
  const { data: submissions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: rawTypes } = await supabase
    .from("log_entry_types")
    .select("slug, name, time_mode")
    .eq("company_id", profile.company_id);
  const slugToType: Record<string, TypeInfo> = {};
  for (const t of rawTypes ?? []) {
    slugToType[t.slug] = { name: t.name, timeMode: (t.time_mode as "job" | "day" | "none") ?? "job" };
  }
  slugToType.standard = slugToType.standard ?? { name: "General", timeMode: "job" };
  const isTimedType = (slug: string) => !slugToType[slug] || slugToType[slug].timeMode !== "none";
  const typeName = (slug: string) => slugToType[slug]?.name ?? (slug === "standard" ? "General" : slug);

  const workers = new Map<string, WorkerAgg>();
  const trend = new Map<string, TrendBucket>();

  for (const sub of submissions ?? []) {
    const userId = sub.user_id as string;
    if (!userId) continue;
    const agg = workers.get(userId) ?? {
      userId,
      employeeName: sub.employee_name as string,
      billableHours: 0,
      nonBillableHours: 0,
      byType: new Map<string, TypeBucket>(),
    };
    workers.set(userId, agg);

    const key = bucketKey(sub.date as string, granularity);
    const bucket = trend.get(key) ?? { periodStart: key, billableHours: 0, nonBillableHours: 0 };
    trend.set(key, bucket);

    const billableEntries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
    for (const entry of billableEntries) {
      const rawHours = entry.subEntries != null
        ? collectEntryHours(
            {
              startTime: entry.startTime as string | undefined,
              endTime: entry.endTime as string | undefined,
              manualHours: entry.manualHours as number | undefined,
              customFields: {},
              subEntries: ((entry.subEntries as Record<string, unknown>[]) ?? []).map((se) => ({
                slug: se.slug as string,
                startTime: se.startTime as string | undefined,
                endTime: se.endTime as string | undefined,
                manualHours: se.manualHours as number | undefined,
              })),
            },
            isTimedType
          )
        : collectOldFormatHours(entry);

      for (const rh of rawHours) {
        addHours(agg, rh, typeName(rh.slug));
        bucket.billableHours += rh.hours;
      }
    }

    const nonBillableEntries = (sub.non_billable_entries as { description: string; hours: string }[]) ?? [];
    const nbHours = nonBillableEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    agg.nonBillableHours += nbHours;
    bucket.nonBillableHours += nbHours;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const workerResults = [...workers.values()]
    .map((agg) => ({
      userId: agg.userId,
      employeeName: agg.employeeName,
      billableHours: round2(agg.billableHours),
      nonBillableHours: round2(agg.nonBillableHours),
      totalHours: round2(agg.billableHours + agg.nonBillableHours),
      byType: [...agg.byType.values()]
        .map((b) => ({ ...b, hours: round2(b.hours) }))
        .sort((a, b) => b.hours - a.hours),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const companyByType = new Map<string, TypeBucket>();
  let companyBillable = 0;
  let companyNonBillable = 0;
  for (const w of workerResults) {
    companyBillable += w.billableHours;
    companyNonBillable += w.nonBillableHours;
    for (const t of w.byType) {
      const bucket = companyByType.get(t.slug) ?? { slug: t.slug, typeName: t.typeName, hours: 0 };
      bucket.hours += t.hours;
      companyByType.set(t.slug, bucket);
    }
  }

  const trendResults = [...trend.values()]
    .map((b) => ({ periodStart: b.periodStart, billableHours: round2(b.billableHours), nonBillableHours: round2(b.nonBillableHours) }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  return NextResponse.json({
    range,
    start,
    end,
    granularity,
    companyTotals: {
      billableHours: round2(companyBillable),
      nonBillableHours: round2(companyNonBillable),
      byType: [...companyByType.values()].map((b) => ({ ...b, hours: round2(b.hours) })).sort((a, b) => b.hours - a.hours),
    },
    workers: workerResults,
    trend: trendResults,
  });
}
