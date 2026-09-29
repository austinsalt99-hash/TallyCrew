"use client";

import { useEffect, useState, type FormEvent } from "react";

// Simplified stand-ins for the real /admin/log-config and BillableEntry
// shapes (LogEntryType / SubEntry) — enough to demonstrate the workflow
// without needing the real schema's per-option rates and worker overrides.
type FieldType = "text" | "number" | "dropdown";
type TimeMode = "job" | "day" | "none";
type RateUnit = "per_hour" | "per_unit";

interface DemoOption {
  label: string;
  rateType: RateUnit | null;
  rateAmount: string;
}

interface DemoField {
  id: string;
  label: string;
  fieldType: FieldType;
  options: DemoOption[];
}

interface DraftOption {
  id: string;
  value: string;
  rateType: RateUnit | "";
  rateAmount: string;
}

interface DraftField {
  id: string;
  label: string;
  fieldType: FieldType;
  options: DraftOption[];
  newOptionText: string;
}

interface DemoLogType {
  id: string;
  name: string;
  timeMode: TimeMode;
  rateAmount: string;
  rateUnit: RateUnit;
  fields: DemoField[];
}

interface DemoSubEntry {
  id: string;
  typeId: string;
  values: Record<string, string>;
  startTime: string;
  endTime: string;
  manualHours: string;
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function calcHours(start: string, end: string): number | undefined {
  if (!start || !end) return undefined;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return undefined;
  return Math.round((mins / 60) * 100) / 100;
}

function hoursLabel(start: string, end: string, manual: string): string {
  const computed = calcHours(start, end);
  const hrs = computed ?? (manual ? parseFloat(manual) : undefined);
  if (hrs == null || Number.isNaN(hrs)) return "";
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function timeModeLabel(mode: TimeMode): string {
  return mode === "job" ? "Timed per job" : mode === "day" ? "Timed per day" : "No timer";
}

const STARTER_TYPE: DemoLogType = {
  id: "starter-trucking",
  name: "Trucking",
  timeMode: "job",
  rateAmount: "12",
  rateUnit: "per_unit",
  fields: [
    {
      id: uid("f"),
      label: "Truck #",
      fieldType: "dropdown",
      options: [
        { label: "Truck 4", rateType: null, rateAmount: "" },
        { label: "Truck 7", rateType: null, rateAmount: "" },
        { label: "Truck 9", rateType: null, rateAmount: "" },
      ],
    },
    {
      id: uid("f"),
      label: "Load Type",
      fieldType: "dropdown",
      options: [
        { label: "Gravel", rateType: "per_unit", rateAmount: "12" },
        { label: "Sand", rateType: "per_unit", rateAmount: "14" },
        { label: "Fill", rateType: "per_unit", rateAmount: "10" },
      ],
    },
    { id: uid("f"), label: "Loads Hauled", fieldType: "number", options: [] },
  ],
};

function emptyDraftField(): DraftField {
  return { id: uid("draft"), label: "", fieldType: "text", options: [], newOptionText: "" };
}

export default function LogTypesSandbox() {
  const [types, setTypes] = useState<DemoLogType[]>([STARTER_TYPE]);

  // Builder form (left pane — mirrors /admin/log-config)
  const [name, setName] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("job");
  const [rateAmount, setRateAmount] = useState("");
  const [rateUnit, setRateUnit] = useState<RateUnit>("per_hour");
  const [draftFields, setDraftFields] = useState<DraftField[]>([emptyDraftField()]);

  // Job card (right pane — mirrors BillableEntry)
  const [client, setClient] = useState("Miller Residence");
  const [description, setDescription] = useState("Framing");
  const [generalStart, setGeneralStart] = useState("07:00");
  const [generalEnd, setGeneralEnd] = useState("15:30");
  const [subEntries, setSubEntries] = useState<DemoSubEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Points the "Added here" callout at whichever pill was just created, on
  // the far side of the panel — cleared after it's been seen or used.
  const [justAddedTypeId, setJustAddedTypeId] = useState<string | null>(null);

  const activeSub = activeId ? subEntries.find((s) => s.id === activeId) ?? null : null;
  const activeType = activeSub ? types.find((t) => t.id === activeSub.typeId) ?? null : null;
  const generalHours = hoursLabel(generalStart, generalEnd, "");

  useEffect(() => {
    if (!justAddedTypeId) return;
    const timer = setTimeout(() => setJustAddedTypeId(null), 5000);
    return () => clearTimeout(timer);
  }, [justAddedTypeId]);

  function updateDraftField(id: string, patch: Partial<DraftField>) {
    setDraftFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function addDraftField() {
    setDraftFields((prev) => [...prev, emptyDraftField()]);
  }
  function removeDraftField(id: string) {
    setDraftFields((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));
  }

  // Dropdown options are their own editable rows (matching /admin/log-config)
  // with a dedicated "New option…" input + Add button — each option row was
  // previously a single comma-separated text field inside <form>, so Enter
  // (the natural way to move to the next option) submitted the whole form
  // instead of adding one.
  function addDraftOption(id: string) {
    setDraftFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const val = f.newOptionText.trim();
        if (!val) return f;
        return {
          ...f,
          options: [...f.options, { id: uid("opt"), value: val, rateType: "", rateAmount: "" }],
          newOptionText: "",
        };
      })
    );
  }
  function updateDraftOption(fieldId: string, optionId: string, patch: Partial<DraftOption>) {
    setDraftFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? { ...f, options: f.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : f
      )
    );
  }
  function removeDraftOption(fieldId: string, optionId: string) {
    setDraftFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, options: f.options.filter((o) => o.id !== optionId) } : f))
    );
  }

  function handleCreateType(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const fields: DemoField[] = draftFields
      .filter((f) => f.label.trim() && !(f.fieldType === "dropdown" && f.options.every((o) => !o.value.trim())))
      .map((f) => ({
        id: f.id,
        label: f.label.trim(),
        fieldType: f.fieldType,
        options: f.fieldType === "dropdown"
          ? f.options
              .filter((o) => o.value.trim())
              .map((o) => ({
                label: o.value.trim(),
                rateType: o.rateType || null,
                rateAmount: o.rateType ? o.rateAmount.trim() : "",
              }))
          : [],
      }));

    const newId = uid("type");
    setTypes((prev) => [
      ...prev,
      { id: newId, name: name.trim(), timeMode, rateAmount: rateAmount.trim(), rateUnit, fields },
    ]);
    setJustAddedTypeId(newId);

    setName("");
    setTimeMode("job");
    setRateAmount("");
    setRateUnit("per_hour");
    setDraftFields([emptyDraftField()]);
  }

  function removeType(id: string) {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setSubEntries((prev) => prev.filter((s) => s.typeId !== id));
    if (activeSub?.typeId === id) setActiveId(null);
    setJustAddedTypeId((cur) => (cur === id ? null : cur));
  }

  function addSubEntry(typeId: string) {
    const id = uid("sub");
    setSubEntries((prev) => [...prev, { id, typeId, values: {}, startTime: "", endTime: "", manualHours: "" }]);
    setActiveId(id);
    setJustAddedTypeId((cur) => (cur === typeId ? null : cur));
  }
  function removeSubEntry(id: string) {
    setSubEntries((prev) => prev.filter((s) => s.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }
  function updateSubValue(id: string, fieldId: string, value: string) {
    setSubEntries((prev) => prev.map((s) => (s.id === id ? { ...s, values: { ...s.values, [fieldId]: value } } : s)));
  }
  function updateSubTime(id: string, patch: Partial<DemoSubEntry>) {
    setSubEntries((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y divide-gray-100 lg:divide-y-0 lg:divide-x lg:divide-gray-200">
        {/* LEFT — Admin: build a log type */}
        <div className="p-6 md:p-8">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Admin · Log Config</p>
          <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Build a custom log type</h2>
          <p className="text-sm text-gray-500 mb-5">
            Add the fields your trade actually tracks. It shows up for your crew immediately — try it on the right.
          </p>

          <form onSubmit={handleCreateType} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Log type name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Machine Operating"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Timing</label>
              <div className="flex gap-1.5">
                {(["job", "day", "none"] as TimeMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTimeMode(m)}
                    className={`flex-1 text-xs font-semibold rounded-lg px-2 py-2 border transition-colors ${
                      timeMode === m
                        ? "bg-navy-600 border-navy-600 text-white"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {m === "job" ? "Per job" : m === "day" ? "Per day" : "No timer"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Fields</label>
              <div className="space-y-2">
                {draftFields.map((f) => (
                  <div key={f.id} className="border border-gray-200 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateDraftField(f.id, { label: e.target.value })}
                        placeholder="Field label, e.g. Truck #"
                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                      <select
                        value={f.fieldType}
                        onChange={(e) => updateDraftField(f.id, { fieldType: e.target.value as FieldType })}
                        className="border border-gray-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="dropdown">Dropdown</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeDraftField(f.id)}
                        aria-label="Remove field"
                        className="text-gray-300 hover:text-red-500 shrink-0 p-1.5 -m-1.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                      </button>
                    </div>
                    {f.fieldType === "dropdown" && (
                      <div className="space-y-1.5 pt-0.5">
                        {f.options.map((opt) => (
                          <div key={opt.id} className="rounded-lg bg-gray-50/80 p-1.5 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={opt.value}
                                onChange={(e) => updateDraftOption(f.id, opt.id, { value: e.target.value })}
                                placeholder="Option"
                                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeDraftOption(f.id, opt.id)}
                                aria-label="Remove option"
                                className="text-red-400 hover:text-red-600 shrink-0 p-1"
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={opt.rateType}
                                onChange={(e) => updateDraftOption(f.id, opt.id, { rateType: e.target.value as RateUnit | "" })}
                                className="min-w-0 flex-1 border border-gray-200 rounded-lg px-1.5 py-1.5 text-[11px] bg-white focus:outline-none"
                              >
                                <option value="">No rate</option>
                                <option value="per_hour">Per hour</option>
                                <option value="per_unit">Per unit</option>
                              </select>
                              {opt.rateType && (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={opt.rateAmount}
                                  onChange={(e) => updateDraftOption(f.id, opt.id, { rateAmount: e.target.value })}
                                  placeholder="0.00"
                                  className="w-20 shrink-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={f.newOptionText}
                            onChange={(e) => updateDraftField(f.id, { newOptionText: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addDraftOption(f.id);
                              }
                            }}
                            placeholder="New option…"
                            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => addDraftOption(f.id)}
                            className="text-xs font-semibold bg-navy-600 hover:bg-navy-700 text-white rounded-lg px-3 py-1.5 shrink-0 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        {f.options.length === 0 && (
                          <p className="text-[10px] text-gray-400">Add at least one option to use this dropdown.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addDraftField}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add field
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Rate (optional)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-24 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <select
                  value={rateUnit}
                  onChange={(e) => setRateUnit(e.target.value as RateUnit)}
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none"
                >
                  <option value="per_hour">per hour</option>
                  <option value="per_unit">per unit</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              Add log type
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
              Your log types ({types.length})
            </p>
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {t.fields.length} field{t.fields.length !== 1 ? "s" : ""} · {timeModeLabel(t.timeMode)}
                      {t.rateAmount && ` · $${t.rateAmount} ${t.rateUnit === "per_hour" ? "/hr" : "/unit"}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeType(t.id)}
                    aria-label={`Delete ${t.name}`}
                    className="text-gray-300 hover:text-red-500 shrink-0 p-1.5 -m-1.5 ml-0.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Crew: log an entry */}
        <div className="p-6 md:p-8 bg-gray-50/60">
          <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-1">Crew · Timesheet</p>
          <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Log a job</h2>
          <p className="text-sm text-gray-500 mb-5">
            Click a log type below to add it to this job — the same way your crew builds an entry in the app.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Job 1</span>
              {generalHours && (
                <span className="text-sm font-semibold text-gray-700 bg-navy-50 px-2 py-0.5 rounded-full">{generalHours}</span>
              )}
            </div>

            {/* Tab strip */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  activeId === null
                    ? "bg-navy-600 text-white border-navy-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-navy-300"
                }`}
              >
                General
              </button>
              {subEntries.map((sub) => {
                const subType = types.find((t) => t.id === sub.typeId);
                const subHours = hoursLabel(sub.startTime, sub.endTime, sub.manualHours);
                const isActive = activeId === sub.id;
                return (
                  <div
                    key={sub.id}
                    className={`flex items-center rounded-xl border-2 transition-colors ${
                      isActive ? "bg-navy-600 border-navy-600" : "bg-white border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(sub.id)}
                      className={`pl-3 pr-1.5 py-1.5 text-sm font-semibold flex items-center gap-1.5 ${
                        isActive ? "text-white" : "text-gray-600"
                      }`}
                    >
                      <span>{subType?.name ?? "Log type"}</span>
                      {subHours && (
                        <span className={`text-xs font-bold ${isActive ? "opacity-80" : "text-navy-600"}`}>{subHours}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSubEntry(sub.id)}
                      aria-label="Remove"
                      className={`pr-2 py-1.5 leading-none ${isActive ? "text-white/60 hover:text-white" : "text-gray-300 hover:text-red-400"}`}
                    >
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* General tab fields */}
            {activeId === null && (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Customer / Client name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Job description"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Start</label>
                    <input
                      type="time"
                      value={generalStart}
                      onChange={(e) => setGeneralStart(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">End</label>
                    <input
                      type="time"
                      value={generalEnd}
                      onChange={(e) => setGeneralEnd(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sub-entry fields */}
            {activeSub && activeType && (
              <div className="space-y-2.5">
                {activeType.fields.length === 0 && (
                  <p className="text-xs text-gray-400 italic">This log type has no custom fields yet.</p>
                )}
                {activeType.fields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-[11px] text-gray-400 mb-1">{field.label}</label>
                    {field.fieldType === "dropdown" ? (
                      <>
                        <select
                          value={activeSub.values[field.id] ?? ""}
                          onChange={(e) => updateSubValue(activeSub.id, field.id, e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-400"
                        >
                          <option value="">Select {field.label.toLowerCase()}…</option>
                          {field.options.map((opt) => (
                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                          ))}
                        </select>
                        {(() => {
                          const selected = field.options.find((o) => o.label === activeSub.values[field.id]);
                          if (!selected?.rateType || !selected.rateAmount) return null;
                          return (
                            <p className="text-[11px] text-navy-600 font-medium mt-1">
                              ${selected.rateAmount} {selected.rateType === "per_hour" ? "/hr" : "/unit"}
                            </p>
                          );
                        })()}
                      </>
                    ) : (
                      <input
                        type={field.fieldType === "number" ? "number" : "text"}
                        value={activeSub.values[field.id] ?? ""}
                        onChange={(e) => updateSubValue(activeSub.id, field.id, e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                      />
                    )}
                  </div>
                ))}

                {activeType.timeMode !== "none" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">
                        Start{activeType.timeMode === "day" ? " (day)" : ""}
                      </label>
                      <input
                        type="time"
                        value={activeSub.startTime}
                        onChange={(e) => updateSubTime(activeSub.id, { startTime: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">
                        End{activeType.timeMode === "day" ? " (day)" : ""}
                      </label>
                      <input
                        type="time"
                        value={activeSub.endTime}
                        onChange={(e) => updateSubTime(activeSub.id, { endTime: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add log type pills */}
            {types.length > 0 && (
              <div className="pt-1">
                {justAddedTypeId && types.some((t) => t.id === justAddedTypeId) && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-blue-600">
                    <svg className="animate-bounce shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                    <span>Added here — tap it to add to the job</span>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-medium shrink-0">Add:</span>
                  {types.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addSubEntry(t.id)}
                      className={`text-xs border border-dashed rounded-full px-2.5 py-1 transition-colors ${
                        t.id === justAddedTypeId
                          ? "border-blue-400 bg-blue-50 text-blue-600 ring-2 ring-blue-300 ring-offset-1"
                          : "text-gray-500 border-gray-300 hover:border-navy-400 hover:text-navy-600"
                      }`}
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            This is exactly how your crew builds a job entry in the real app — tap a log type to add it, fill in
            what it asks for, and move on to the next one.
          </p>
        </div>
      </div>
    </div>
  );
}
