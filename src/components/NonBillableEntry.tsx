"use client";

export interface NonBillableEntryData {
  id: string;
  description: string;
  hours: string;
}

interface Props {
  entry: NonBillableEntryData;
  onChange: (entry: NonBillableEntryData) => void;
  onRemove: () => void;
  showRemove: boolean;
}

export default function NonBillableEntry({ entry, onChange, onRemove, showRemove }: Props) {
  const update = (field: keyof NonBillableEntryData, value: string) =>
    onChange({ ...entry, [field]: value });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">Non-Billable</span>
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

      <input
        type="text"
        placeholder="Description (e.g. Fuel run, Shop errands)"
        value={entry.description}
        onChange={(e) => update("description", e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

      <div>
        <label className="block text-xs text-gray-500 mb-1">Hours spent</label>
        <input
          type="number"
          placeholder="e.g. 0.5"
          min="0"
          step="0.25"
          value={entry.hours}
          onChange={(e) => update("hours", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
    </div>
  );
}
