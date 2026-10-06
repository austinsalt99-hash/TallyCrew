// Units for per-unit priced items are stored in the entry's customFields next
// to the other log values. The "__units" suffix can't collide with a field_key
// because toSlug never produces a double underscore from a single label.

// Type-level per-unit rate (log_entry_types.rate_type === "per_unit")
export const TYPE_UNITS_KEY = "__units";

// Per-option per-unit rate on a dropdown field, e.g. "Bag of dirt" under "Material"
export function unitsKey(fieldKey: string): string {
  return `${fieldKey}__units`;
}

// Missing key = entry logged before units existed, so it counts as one unit
// (the old flat-rate behavior). An empty or unparseable value counts as zero.
export function parseUnits(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
