"use client";

import type { LogEntryType } from "@/types/logConfig";

export interface BillableEntryData {
  id: string;
  client: string;
  description: string;
  startTime: string;
  endTime: string;
  entryType?: string;
  customFields?: Record<string, string>;
}

function calcHours(start: string, end: string): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  entry: BillableEntryData;
  onChange: (entry: BillableEntryData) => void;
  onRemove: () => void;
  showRemove: boolean;
  entryTypes: LogEntryType[];
}

export default function BillableEntry({ entry, onChange, onRemove, showRemove, entryTypes }: Props) {
  const update = (field: keyof BillableEntryData, value: string) =>
    onChange({ ...entry, [field]: value });

  const updateCustomField = (key: string, value: string) =>
    onChange({ ...entry, customFields: { ...(entry.customFields ?? {}), [key]: value } });

  const selectType = (slug: string) =>
    onChange({ ...entry, entryType: slug, client: "", description: "", customFields: {} });

  const hours = calcHours(entry.startTime, entry.endTime);
  const activeSlug = entry.entryType ?? "standard";
  const customType = entryTypes.find((t) => t.slug === activeSlug);
  const isCustom = activeSlug !== "standard" && !!customType;
  const hasCustomTypes = entryTypes.length > 0;
  const showTime = !isCustom || (customType?.is_timed !== false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Billable</span>
        <div className="flex items-center gap-2">
          {hours !== "—" && (
            <span className="text-sm font-semibold text-gray-700 bg-blue-50 px-2 py-0.5 rounded-full">
              {hours}
            </span>
          )}
          {showRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-red-400 hover:text-red-600 text-lg leading-none font-bold"
              aria-label="Remove entry"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {hasCustomTypes && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => selectType("standard")}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              activeSlug === "standard"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-300 hover:border-blue-400"
            }`}
          >
            Standard
          </button>
          {entryTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectType(t.slug)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                activeSlug === t.slug
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-300 hover:border-blue-400"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {isCustom ? (
        <div className="space-y-3">
          {customType!.fields
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((field) => (
              <div key={field.id}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                {field.field_type === "dropdown" ? (
                  <select
                    value={entry.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateCustomField(field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  >
                    <option value="">Select {field.label.toLowerCase()}…</option>
                    {field.options
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((opt) => (
                        <option key={opt.id} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                  </select>
                ) : field.field_type === "number" ? (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={entry.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateCustomField(field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                ) : (
                  <input
                    type="text"
                    value={entry.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateCustomField(field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                )}
              </div>
            ))}
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Customer / Client name"
            value={entry.client}
            onChange={(e) => update("client", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text"
            placeholder="Job description"
            value={entry.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </>
      )}

      {showTime && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Start time</label>
            <input
              type="time"
              value={entry.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">End time</label>
            <input
              type="time"
              value={entry.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
