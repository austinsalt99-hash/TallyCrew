"use client";

export interface BillableEntryData {
  id: string;
  client: string;
  description: string;
  startTime: string;
  endTime: string;
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
}

export default function BillableEntry({ entry, onChange, onRemove, showRemove }: Props) {
  const update = (field: keyof BillableEntryData, value: string) =>
    onChange({ ...entry, [field]: value });

  const hours = calcHours(entry.startTime, entry.endTime);

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

      <div className="flex gap-3">
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
    </div>
  );
}
