"use client";

import type { LogEntryType } from "@/types/logConfig";
import { TYPE_UNITS_KEY, unitsKey } from "@/lib/unitQty";

interface Props {
  type: LogEntryType;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400";
const selectClass = `${inputClass} bg-white`;

// Renders a log type's fields. Any per-unit price (on a dropdown option or on
// the type itself) automatically gets a units input, so the employee can enter
// how many were used and the invoice can multiply by it.
export default function LogFieldInputs({ type, values, onChange }: Props) {
  const sortedFields = type.fields.slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {sortedFields.map((field) => {
        if (field.field_type === "dropdown") {
          const selected = field.options.find((o) => o.label === values[field.field_key]);
          const perUnit = selected?.rate_type === "per_unit";
          const uKey = unitsKey(field.field_key);
          return (
            <div key={field.id} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <select
                  value={values[field.field_key] ?? ""}
                  onChange={(e) => {
                    const label = e.target.value;
                    const next = { ...values, [field.field_key]: label };
                    const opt = field.options.find((o) => o.label === label);
                    if (opt?.rate_type === "per_unit") {
                      next[uKey] = values[uKey] ?? "1";
                    } else {
                      delete next[uKey];
                    }
                    onChange(next);
                  }}
                  className={selectClass}
                >
                  <option value="">Select {field.label.toLowerCase()}…</option>
                  {field.options
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((opt) => (
                      <option key={opt.id} value={opt.label}>{opt.label}</option>
                    ))}
                </select>
              </div>
              {perUnit && (
                <UnitsInput
                  label={`Units of ${selected.label}`}
                  value={values[uKey] ?? "1"}
                  onChange={(v) => onChange({ ...values, [uKey]: v })}
                />
              )}
            </div>
          );
        }

        if (field.field_type === "number") {
          return (
            <div key={field.id}>
              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
              <input
                type="number" min="0" step="0.01" placeholder="0"
                value={values[field.field_key] ?? ""}
                onChange={(e) => onChange({ ...values, [field.field_key]: e.target.value })}
                className={inputClass}
              />
            </div>
          );
        }

        return (
          <div key={field.id}>
            <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
            <input
              type="text"
              value={values[field.field_key] ?? ""}
              onChange={(e) => onChange({ ...values, [field.field_key]: e.target.value })}
              className={inputClass}
            />
          </div>
        );
      })}

      {type.rate_type === "per_unit" && (
        <UnitsInput
          label={`Units (${type.name})`}
          value={values[TYPE_UNITS_KEY] ?? "1"}
          onChange={(v) => onChange({ ...values, [TYPE_UNITS_KEY]: v })}
        />
      )}
    </>
  );
}

function UnitsInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number" min="0" step="any" inputMode="decimal" placeholder="Units"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
