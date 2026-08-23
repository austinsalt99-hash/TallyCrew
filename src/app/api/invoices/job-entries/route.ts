import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { collectEntryHours } from "@/lib/billableHours";

function calcHours(start?: string, end?: string, manual?: number | null): number {
  if (manual != null) return manual;
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}

function formatHoursStr(h: number): string {
  if (h === 0) return "";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

interface TypeInfo {
  id: string;
  name: string;
  timeMode: "job" | "day" | "none";
  dropdownFieldKeys: string[];
  fieldRates: Record<string, { rate_type: string; rate_amount: number; label: string }>;
  typeRateType?: string | null;
  typeRateAmount?: number | null;
}

type OptionRateMap = Record<string, Record<string, Record<string, { rate_type: string; rate_amount: number }>>>;

interface CalcResult {
  amount: string;
  priceBasis: string[];
  rate: string;
}

function calcAmountDetailed(
  type: TypeInfo | undefined,
  hours: number,
  dropdownFields: Record<string, string>,
  numberFieldTotals: Record<string, number>,
  optionRates: OptionRateMap,
): CalcResult {
  if (!type) return { amount: "", priceBasis: [], rate: "" };
  let total = 0;
  const priceBasis: string[] = [];
  let rate = "";

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
          if (!rate) rate = `$${opt.rate_amount.toFixed(2)}/hr`;
        } else if (opt.rate_type === "per_unit") {
          total += opt.rate_amount;
          priceBasis.push(`${selectedLabel} (flat rate) = $${opt.rate_amount.toFixed(2)}`);
          if (!rate) rate = `$${opt.rate_amount.toFixed(2)} flat`;
        }
      }
    }
  }

  for (const [fieldKey, fieldRate] of Object.entries(type.fieldRates)) {
    const val = numberFieldTotals[fieldKey] ?? 0;
    if (val > 0) {
      const contrib = val * fieldRate.rate_amount;
      total += contrib;
      const unit = fieldRate.rate_type === "per_hour" ? "hr" : "unit";
      priceBasis.push(`${fieldRate.label}: ${val} ${unit}${val !== 1 ? "s" : ""} × $${fieldRate.rate_amount}/${unit} = $${contrib.toFixed(2)}`);
      if (!rate) rate = `$${fieldRate.rate_amount.toFixed(2)}/${unit}`;
    }
  }

  if (total === 0 && type.typeRateAmount && type.typeRateAmount > 0) {
    if (type.typeRateType === "per_hour" && hours > 0) {
      const contrib = hours * type.typeRateAmount;
      total += contrib;
      priceBasis.push(`${type.name} @ $${type.typeRateAmount}/hr × ${hours}h = $${contrib.toFixed(2)}`);
      rate = `$${type.typeRateAmount.toFixed(2)}/hr`;
    } else if (type.typeRateType === "per_unit") {
      total += type.typeRateAmount;
      priceBasis.push(`${type.name} (flat rate) = $${type.typeRateAmount.toFixed(2)}`);
      rate = `$${type.typeRateAmount.toFixed(2)} flat`;
    }
  }

  return { amount: total > 0 ? total.toFixed(2) : "", priceBasis, rate };
}

function buildDescription(typeName: string, customFields: Record<string, string>, typeInfo: TypeInfo | undefined, allFieldLabels: Record<string, string>): string {
  if (!typeInfo) return typeName;
  const parts: string[] = [];
  for (const fk of typeInfo.dropdownFieldKeys) {
    const val = customFields[fk];
    if (val) parts.push(val);
  }
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
    .select("id, user_id, employee_name, date, billable_entries")
    .eq("company_id", profile.company_id)
    .filter("billable_entries", "cs", JSON.stringify([{ linkedEventId: eventId }]));

  const { data: rawTypes } = await supabase
    .from("log_entry_types")
    .select("id, slug, name, time_mode, rate_type, rate_amount")
    .eq("company_id", profile.company_id);

  const allTypeIds = (rawTypes ?? []).map((t) => t.id);

  // Per-worker override of the client billing rate for a type (e.g. General).
  // Takes priority over the flat type rate_amount.
  const workerTypeRates: Record<string, Record<string, number>> = {};
  if (allTypeIds.length > 0) {
    const { data: typeWorkerRateRows } = await supabase
      .from("log_entry_type_worker_rates")
      .select("type_id, worker_id, rate_amount")
      .in("type_id", allTypeIds);
    for (const r of typeWorkerRateRows ?? []) {
      if (!workerTypeRates[r.type_id]) workerTypeRates[r.type_id] = {};
      workerTypeRates[r.type_id][r.worker_id] = Number(r.rate_amount);
    }
  }

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

  const dropdownFieldIds = allFields.filter((f) => f.field_type === "dropdown").map((f) => f.id);
  let optionRows: { field_id: string; label: string; rate_type: string | null; rate_amount: number | null }[] = [];
  if (dropdownFieldIds.length > 0) {
    const { data: opts } = await supabase
      .from("log_entry_field_options")
      .select("field_id, label, rate_type, rate_amount")
      .in("field_id", dropdownFieldIds);
    optionRows = (opts ?? []).filter((o) => o.rate_amount != null);
  }

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

  const slugToType: Record<string, TypeInfo> = {};
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
      typeRateType: t.rate_type ?? null,
      typeRateAmount: t.rate_amount ?? null,
    };
  }

  // ── Per-submission types ──────────────────────────────────────────────────

  interface RawEntry {
    slug: string;
    customFields: Record<string, string>;
    hours: number;
    employee: string;
    workerId: string;
    date: string;
  }

  interface EntryGroup {
    slug: string;
    typeInfo: TypeInfo | undefined;
    dropdownFields: Record<string, string>;
    entries: { employee: string; workerId: string; date: string; hours: number; numberFields: Record<string, number> }[];
  }

  interface LineItemResponse {
    id: string;
    description: string;
    employee: string;
    date: string;
    hours: number;
    amount: string;
    rate: string;
    sourceJobId: string;
    sourceJobTitle: string;
    priceBasis?: string[];
    breakdown?: { employee: string; date: string; hours: number }[];
  }

  interface WorkItemDisplay {
    slug: string;
    typeName: string;
    hours: string;
    description: string;
  }

  function collectRawEntries(
    entry: Record<string, unknown>,
    employeeName: string,
    workerId: string,
    date: string,
  ): RawEntry[] {
    const result: RawEntry[] = [];
    const parentHours = calcHours(
      entry.startTime as string | undefined,
      entry.endTime as string | undefined,
      entry.manualHours as number | null | undefined,
    );
    const parentCustomFields = (entry.customFields as Record<string, string>) ?? {};
    const isNewFormat = entry.subEntries != null;

    if (isNewFormat) {
      const subEntries = (entry.subEntries as Record<string, unknown>[]) ?? [];
      // Sub-entry hours (e.g. Machine Operating) are carved out of the parent
      // General window, not additional time on top of it.
      const rawHours = collectEntryHours(
        {
          startTime: entry.startTime as string | undefined,
          endTime: entry.endTime as string | undefined,
          manualHours: entry.manualHours as number | undefined,
          customFields: parentCustomFields,
          subEntries: subEntries.map((se) => ({
            slug: se.slug as string,
            startTime: se.startTime as string | undefined,
            endTime: se.endTime as string | undefined,
            manualHours: se.manualHours as number | undefined,
            customFields: (se.customFields as Record<string, string>) ?? {},
          })),
        },
        (slug) => {
          const t = slugToType[slug];
          return !t || t.timeMode !== "none";
        }
      );
      for (const rh of rawHours) {
        result.push({ slug: rh.slug, customFields: rh.customFields, hours: rh.hours, employee: employeeName, workerId, date });
      }
    } else {
      const activeSlug = (entry.entryType as string) || "standard";
      const activeHasData = parentHours > 0 || Object.values(parentCustomFields).some(Boolean);
      if (activeHasData) {
        result.push({ slug: activeSlug, customFields: parentCustomFields, hours: parentHours, employee: employeeName, workerId, date });
      }
      const typeData = (entry._typeData as Record<string, Record<string, unknown>> | undefined) ?? {};
      for (const [tdSlug, snapshot] of Object.entries(typeData)) {
        if (tdSlug === activeSlug) continue; // skip if same as active — _typeData shouldn't include the active type but can via stale snapshots
        const tdTypeInfo = slugToType[tdSlug];
        const tdCustomFields = (snapshot.customFields as Record<string, string>) ?? {};
        const tdHours = calcHours(snapshot.startTime as string | undefined, snapshot.endTime as string | undefined, snapshot.manualHours as number | null | undefined);
        const isTimedType = !tdTypeInfo || tdTypeInfo.timeMode !== "none";
        const hours = tdHours > 0 ? tdHours : (isTimedType ? parentHours : 0);
        result.push({ slug: tdSlug, customFields: tdCustomFields, hours, employee: employeeName, workerId, date });
      }
    }

    return result;
  }

  function buildLineItemsFromRaw(rawEntries: RawEntry[], jobId: string, jobTitle: string): LineItemResponse[] {
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
      groups.get(gk)!.entries.push({ employee: re.employee, workerId: re.workerId, date: re.date, hours: re.hours, numberFields });
    }

    const lineItems: LineItemResponse[] = [];

    for (const group of groups.values()) {
      const { slug, typeInfo, dropdownFields, entries } = group;
      const typeName = typeInfo?.name ?? slug;
      const description = buildDescription(
        typeName,
        { ...dropdownFields, ...Object.fromEntries(entries.flatMap(e => Object.entries(e.numberFields).map(([k, v]) => [k, String(v)]))) },
        typeInfo,
        allFieldLabels,
      );
      const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;

      const numberFieldTotals: Record<string, number> = {};
      for (const e of entries) {
        for (const [k, v] of Object.entries(e.numberFields)) {
          numberFieldTotals[k] = (numberFieldTotals[k] ?? 0) + v;
        }
      }

      const { amount: fieldAmount, priceBasis: fieldPriceBasis, rate: fieldRate } = calcAmountDetailed(typeInfo, totalHours, dropdownFields, numberFieldTotals, optionRates);
      let amount = fieldAmount;
      let priceBasis = fieldPriceBasis;
      let rate = fieldRate;

      if (!amount) {
        // Per-worker client billing rate for this type (e.g. General).
        const rateEntries = entries
          .filter((e) => e.hours > 0)
          .map((e) => ({ ...e, effectiveRate: (typeInfo ? workerTypeRates[typeInfo.id]?.[e.workerId] : undefined) ?? 0 }))
          .filter((e) => e.effectiveRate > 0);
        const rateTotal = rateEntries.reduce((sum, e) => sum + e.hours * e.effectiveRate, 0);
        if (rateTotal > 0) {
          amount = rateTotal.toFixed(2);
          priceBasis = rateEntries.map((e) => `${e.employee}: ${e.hours}h × $${e.effectiveRate.toFixed(2)}/hr = $${(e.hours * e.effectiveRate).toFixed(2)}`);
          const uniqueRates = [...new Set(rateEntries.map((e) => e.effectiveRate))];
          rate = uniqueRates.length === 1 ? `$${uniqueRates[0].toFixed(2)}/hr` : "Varies";
        }
      }

      const uniqueEmployees = [...new Set(entries.map((e) => e.employee))];
      const employeeLabel =
        uniqueEmployees.length === 1 ? uniqueEmployees[0]
        : uniqueEmployees.length === 2 ? uniqueEmployees.join(" & ")
        : `${uniqueEmployees.length} employees`;

      const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));

      lineItems.push({
        id: crypto.randomUUID(),
        description,
        employee: employeeLabel,
        date: sortedEntries[0].date,
        hours: totalHours,
        amount,
        rate,
        sourceJobId: jobId,
        sourceJobTitle: jobTitle,
        priceBasis: priceBasis.length > 0 ? priceBasis : undefined,
        breakdown: sortedEntries.length > 1 ? sortedEntries : undefined,
      });
    }

    lineItems.sort((a, b) => a.description.localeCompare(b.description) || a.date.localeCompare(b.date));
    return lineItems;
  }

  // ── Build per-submission results ──────────────────────────────────────────

  const submissionsResult: {
    submissionId: string;
    employee: string;
    date: string;
    workItems: WorkItemDisplay[];
    lineItems: LineItemResponse[];
  }[] = [];

  for (const sub of submissions ?? []) {
    const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];

    const subRawEntries: RawEntry[] = [];
    for (const entry of entries) {
      if ((entry.linkedEventId as string) !== eventId) continue;
      subRawEntries.push(...collectRawEntries(entry, sub.employee_name, sub.user_id as string, sub.date));
    }

    if (subRawEntries.length === 0) continue;

    // Build display-friendly work items
    const workItems: WorkItemDisplay[] = subRawEntries.map((re) => {
      const typeInfo = slugToType[re.slug];
      const typeName = typeInfo?.name ?? re.slug;
      return {
        slug: re.slug,
        typeName,
        hours: formatHoursStr(re.hours),
        description: buildDescription(typeName, re.customFields, typeInfo, allFieldLabels),
      };
    });

    submissionsResult.push({
      submissionId: sub.id,
      employee: sub.employee_name,
      date: sub.date,
      workItems,
      lineItems: buildLineItemsFromRaw(subRawEntries, eventId, event.title),
    });
  }

  submissionsResult.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));

  return NextResponse.json({ event, submissions: submissionsResult });
}
