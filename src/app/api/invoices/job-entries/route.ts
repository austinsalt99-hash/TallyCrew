import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";

function calcHours(start?: string, end?: string, manual?: number | null): number {
  if (manual != null) return manual;
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}

interface TypeInfo {
  id: string;
  name: string;
  timeMode: "job" | "day" | "none"; // "none" = no clock hours
  dropdownFieldKeys: string[];
  fieldRates: Record<string, { rate_type: string; rate_amount: number; label: string }>;
}

type OptionRateMap = Record<string, Record<string, Record<string, { rate_type: string; rate_amount: number }>>>;

interface CalcResult {
  amount: string;
  priceBasis: string[];
}

function calcAmountDetailed(
  type: TypeInfo | undefined,
  hours: number,
  dropdownFields: Record<string, string>,
  numberFieldTotals: Record<string, number>,
  optionRates: OptionRateMap,
): CalcResult {
  if (!type) return { amount: "", priceBasis: [] };
  let total = 0;
  const priceBasis: string[] = [];

  const typeRates = optionRates[type.id];
  if (typeRates) {
    for (const [fieldKey, selectedLabel] of Object.entries(dropdownFields)) {
      if (!selectedLabel) continue;
      const opt = typeRates[fieldKey]?.[selectedLabel];
      if (opt?.rate_amount) {
        if (opt.rate_type === "per_hour" && hours > 0) {
          const contrib = hours * opt.rate_amount;
          total += contrib;
          priceBasis.push(`${selectedLabel} @ $${opt.rate_amount}/hr × ${hours}h = $${contrib.toFixed(2)}`);
        } else if (opt.rate_type === "per_unit") {
          total += opt.rate_amount;
          priceBasis.push(`${selectedLabel} (flat rate) = $${opt.rate_amount.toFixed(2)}`);
        }
      }
    }
  }

  for (const [fieldKey, rate] of Object.entries(type.fieldRates)) {
    const val = numberFieldTotals[fieldKey] ?? 0;
    if (val > 0) {
      const contrib = val * rate.rate_amount;
      total += contrib;
      const unit = rate.rate_type === "per_hour" ? "hr" : "unit";
      priceBasis.push(`${rate.label}: ${val} ${unit}${val !== 1 ? "s" : ""} × $${rate.rate_amount}/${unit} = $${contrib.toFixed(2)}`);
    }
  }

  return { amount: total > 0 ? total.toFixed(2) : "", priceBasis };
}

// Build a human-readable description from a type name + its custom field values
function buildDescription(typeName: string, customFields: Record<string, string>, typeInfo: TypeInfo | undefined, allFieldLabels: Record<string, string>): string {
  if (!typeInfo) return typeName;
  // Show dropdown field values and non-empty text/number field values
  const parts: string[] = [];
  for (const fk of typeInfo.dropdownFieldKeys) {
    const val = customFields[fk];
    if (val) parts.push(val);
  }
  // Also include number field values
  for (const fk of Object.keys(typeInfo.fieldRates)) {
    const val = customFields[fk];
    if (val && val !== "0") {
      const label = allFieldLabels[fk] ?? fk;
      parts.push(`${val} ${label.toLowerCase()}`);
    }
  }
  return parts.length > 0 ? `${typeName} – ${parts.join(", ")}` : typeName;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const { data: event } = await supabase
    .from("job_events")
    .select("id, title, client, date, location, description")
    .eq("id", eventId)
    .eq("company_id", profile.company_id)
    .single();

  if (!event) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, employee_name, date, billable_entries")
    .eq("company_id", profile.company_id)
    .filter("billable_entries", "cs", JSON.stringify([{ linkedEventId: eventId }]));

  // Fetch all log types for this company
  const { data: rawTypes } = await supabase
    .from("log_entry_types")
    .select("id, slug, name, time_mode")
    .eq("company_id", profile.company_id);

  const allTypeIds = (rawTypes ?? []).map((t) => t.id);

  let allFields: {
    id: string; type_id: string; label: string; field_key: string;
    field_type: string; rate_type: string | null; rate_amount: number | null;
  }[] = [];
  if (allTypeIds.length > 0) {
    const { data: fields } = await supabase
      .from("log_entry_fields")
      .select("id, type_id, label, field_key, field_type, rate_type, rate_amount")
      .in("type_id", allTypeIds);
    allFields = fields ?? [];
  }

  // Fetch dropdown option rates
  const dropdownFieldIds = allFields.filter((f) => f.field_type === "dropdown").map((f) => f.id);
  let optionRows: { field_id: string; label: string; rate_type: string | null; rate_amount: number | null }[] = [];
  if (dropdownFieldIds.length > 0) {
    const { data: opts } = await supabase
      .from("log_entry_field_options")
      .select("field_id, label, rate_type, rate_amount")
      .in("field_id", dropdownFieldIds);
    optionRows = (opts ?? []).filter((o) => o.rate_amount != null);
  }

  // Build optionRates map: typeId → fieldKey → optionLabel → rate
  const optionRates: OptionRateMap = {};
  for (const t of rawTypes ?? []) {
    for (const f of allFields.filter((f) => f.type_id === t.id && f.field_type === "dropdown")) {
      for (const o of optionRows.filter((o) => o.field_id === f.id)) {
        if (!optionRates[t.id]) optionRates[t.id] = {};
        if (!optionRates[t.id][f.field_key]) optionRates[t.id][f.field_key] = {};
        optionRates[t.id][f.field_key][o.label] = { rate_type: o.rate_type!, rate_amount: o.rate_amount! };
      }
    }
  }

  // Build slugToType — includes ALL types (standard + custom)
  const slugToType: Record<string, TypeInfo> = {};
  // fieldKey → label lookup (for description building)
  const allFieldLabels: Record<string, string> = {};
  for (const t of rawTypes ?? []) {
    const fieldRates: Record<string, { rate_type: string; rate_amount: number; label: string }> = {};
    for (const f of allFields.filter((f) => f.type_id === t.id && f.field_type === "number" && f.rate_amount != null)) {
      fieldRates[f.field_key] = { rate_type: f.rate_type!, rate_amount: f.rate_amount!, label: f.label };
    }
    const dropdownFieldKeys = allFields
      .filter((f) => f.type_id === t.id && f.field_type === "dropdown")
      .map((f) => f.field_key)
      .sort();
    for (const f of allFields.filter((f) => f.type_id === t.id)) {
      allFieldLabels[f.field_key] = f.label;
    }
    slugToType[t.slug] = {
      id: t.id,
      name: t.name,
      timeMode: (t.time_mode as "job" | "day" | "none") ?? "job",
      dropdownFieldKeys,
      fieldRates,
    };
  }

  // ── Collect raw sub-entries ───────────────────────────────────────────────
  //
  // For EVERY billable entry linked to this job we produce:
  //   • One raw entry for the General tab (slug="standard", top-level fields/time)
  //     — only if it has non-zero hours OR non-empty customFields
  //   • One raw entry per sub-entry tab (each has its own slug + customFields)
  //
  // For sub-entries with a timed type but no own time data, we fall back to the
  // parent entry's General-tab time so the hours aren't silently lost.

  interface RawEntry {
    slug: string;
    customFields: Record<string, string>;
    hours: number;        // already computed
    employee: string;
    date: string;
    entryDesc: string;
  }

  const rawEntries: RawEntry[] = [];

  for (const sub of submissions ?? []) {
    const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
    for (const entry of entries) {
      if ((entry.linkedEventId as string) !== eventId) continue;

      const entryDesc = (entry.description as string) || (entry.client as string) || "";
      const parentHours = calcHours(
        entry.startTime as string | undefined,
        entry.endTime as string | undefined,
        entry.manualHours as number | null | undefined,
      );
      const parentCustomFields = (entry.customFields as Record<string, string>) ?? {};

      const isNewFormat = entry.subEntries != null;

      if (isNewFormat) {
        // ── NEW FORMAT: subEntries array ────────────────────────────────
        const subEntries = (entry.subEntries as Record<string, unknown>[]) ?? [];

        // General tab — include if has hours or non-empty custom fields
        const hasGeneralData = parentHours > 0 || Object.values(parentCustomFields).some(Boolean);
        if (hasGeneralData) {
          rawEntries.push({
            slug: "standard",
            customFields: parentCustomFields,
            hours: parentHours,
            employee: sub.employee_name,
            date: sub.date,
            entryDesc,
          });
        }

        for (const se of subEntries) {
          const seSlug = se.slug as string;
          const seTypeInfo = slugToType[seSlug];
          const seCustomFields = (se.customFields as Record<string, string>) ?? {};
          const ownHours = calcHours(
            se.startTime as string | undefined,
            se.endTime as string | undefined,
            se.manualHours as number | null | undefined,
          );
          const isTimedType = !seTypeInfo || seTypeInfo.timeMode !== "none";
          const hours = ownHours > 0 ? ownHours : (isTimedType ? parentHours : 0);
          rawEntries.push({
            slug: seSlug,
            customFields: seCustomFields,
            hours,
            employee: sub.employee_name,
            date: sub.date,
            entryDesc,
          });
        }
      } else {
        // ── OLD FORMAT: active type at top level + _typeData snapshots ──
        const activeSlug = (entry.entryType as string) || "standard";
        const activeHasData = parentHours > 0 || Object.values(parentCustomFields).some(Boolean);
        if (activeHasData) {
          rawEntries.push({
            slug: activeSlug,
            customFields: parentCustomFields,
            hours: parentHours,
            employee: sub.employee_name,
            date: sub.date,
            entryDesc,
          });
        }

        // Other types the user filled in are stored in _typeData
        const typeData = (entry._typeData as Record<string, Record<string, unknown>> | undefined) ?? {};
        for (const [tdSlug, snapshot] of Object.entries(typeData)) {
          const tdTypeInfo = slugToType[tdSlug];
          const tdCustomFields = (snapshot.customFields as Record<string, string>) ?? {};
          const tdHours = calcHours(
            snapshot.startTime as string | undefined,
            snapshot.endTime as string | undefined,
            snapshot.manualHours as number | null | undefined,
          );
          const isTimedType = !tdTypeInfo || tdTypeInfo.timeMode !== "none";
          const hours = tdHours > 0 ? tdHours : (isTimedType ? parentHours : 0);
          rawEntries.push({
            slug: tdSlug,
            customFields: tdCustomFields,
            hours,
            employee: sub.employee_name,
            date: sub.date,
            entryDesc,
          });
        }
      }
    }
  }

  // ── Debug logging (remove after diagnosis) ──────────────────────────────
  console.log(`[job-entries] eventId=${eventId}, submissions=${submissions?.length ?? 0}`);
  for (const sub of submissions ?? []) {
    const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
    const matching = entries.filter((e) => (e.linkedEventId as string) === eventId);
    console.log(`  sub [${sub.employee_name}/${sub.date}]: ${entries.length} entries, ${matching.length} match`);
    for (const e of matching) {
      const subs = Array.isArray(e.subEntries) ? e.subEntries : [];
      console.log(`    isNewFormat=${e.subEntries != null}, subEntries.length=${subs.length}`);
      for (const se of subs as Record<string, unknown>[]) {
        console.log(`      sub-entry slug="${se.slug}" customFields=${JSON.stringify(se.customFields ?? {})}`);
      }
    }
  }
  console.log(`[job-entries] rawEntries (${rawEntries.length}):`, rawEntries.map((r) => `${r.slug}(${r.hours}h)`).join(", "));

  // ── Group by slug + dropdown field selections ─────────────────────────────

  interface EntryGroup {
    slug: string;
    typeInfo: TypeInfo | undefined;
    dropdownFields: Record<string, string>;
    entries: { employee: string; date: string; hours: number; numberFields: Record<string, number> }[];
  }

  const groups = new Map<string, EntryGroup>();

  for (const re of rawEntries) {
    const typeInfo = slugToType[re.slug];
    const ddKeys = typeInfo?.dropdownFieldKeys ?? [];
    const ddParts = ddKeys.map((k) => `${k}=${re.customFields[k] ?? ""}`);
    const gk = [re.slug, ...ddParts].join("||");

    const numberFields: Record<string, number> = {};
    if (typeInfo?.fieldRates) {
      for (const fk of Object.keys(typeInfo.fieldRates)) {
        const v = parseFloat(re.customFields[fk] ?? "0") || 0;
        if (v > 0) numberFields[fk] = v;
      }
    }

    if (!groups.has(gk)) {
      const ddFields: Record<string, string> = {};
      for (const k of ddKeys) { if (re.customFields[k]) ddFields[k] = re.customFields[k]; }
      groups.set(gk, { slug: re.slug, typeInfo, dropdownFields: ddFields, entries: [] });
    }
    groups.get(gk)!.entries.push({
      employee: re.employee,
      date: re.date,
      hours: re.hours,
      numberFields,
    });
  }

  // ── Build consolidated line items ─────────────────────────────────────────

  const lineItems: {
    id: string;
    description: string;
    employee: string;
    date: string;
    hours: number;
    amount: string;
    sourceJobId: string;
    sourceJobTitle: string;
    priceBasis?: string[];
    breakdown?: { employee: string; date: string; hours: number }[];
  }[] = [];

  for (const group of groups.values()) {
    const { slug, typeInfo, dropdownFields, entries } = group;
    const typeName = typeInfo?.name ?? slug;

    // Build description: type name + all meaningful field values
    const description = buildDescription(typeName, { ...dropdownFields, ...Object.fromEntries(entries.flatMap(e => Object.entries(e.numberFields).map(([k, v]) => [k, String(v)]))) }, typeInfo, allFieldLabels);

    const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;

    const numberFieldTotals: Record<string, number> = {};
    for (const e of entries) {
      for (const [k, v] of Object.entries(e.numberFields)) {
        numberFieldTotals[k] = (numberFieldTotals[k] ?? 0) + v;
      }
    }

    const { amount, priceBasis } = calcAmountDetailed(
      typeInfo, totalHours, dropdownFields, numberFieldTotals, optionRates,
    );

    const uniqueEmployees = [...new Set(entries.map((e) => e.employee))];
    const employeeLabel =
      uniqueEmployees.length === 1 ? uniqueEmployees[0]
      : uniqueEmployees.length === 2 ? uniqueEmployees.join(" & ")
      : `${uniqueEmployees.length} employees`;

    const sortedEntries = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee),
    );

    lineItems.push({
      id: crypto.randomUUID(),
      description,
      employee: employeeLabel,
      date: sortedEntries[0].date,
      hours: totalHours,
      amount,
      sourceJobId: eventId,
      sourceJobTitle: event.title,
      priceBasis: priceBasis.length > 0 ? priceBasis : undefined,
      breakdown: sortedEntries.length > 1 ? sortedEntries : undefined,
    });
  }

  lineItems.sort((a, b) => a.description.localeCompare(b.description) || a.date.localeCompare(b.date));

  return NextResponse.json({ event, lineItems });
}
