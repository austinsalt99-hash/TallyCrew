"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import BillableEntry, { BillableEntryData } from "@/components/BillableEntry";
import TimesheetForm from "@/components/TimesheetForm";
import type { LogEntryType, LogEntryField, LogEntryFieldOption, TypeWorkerRate } from "@/types/logConfig";

const NAVY = "#0A1172";

function authHeader() {
  return { "Content-Type": "application/json" };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

type TimeMode = "job" | "day" | "none";

interface Worker {
  id: string;
  full_name: string;
  role: string;
}

export default function LogConfigPage() {
  const [types, setTypes] = useState<LogEntryType[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<LogEntryType | null>(null);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // New type form
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePosition, setNewTypePosition] = useState<"job" | "day">("job");
  const [newTypeTimed, setNewTypeTimed] = useState(true);
  const [addingType, setAddingType] = useState(false);

  // New field forms keyed by type id
  const [newFieldName, setNewFieldName] = useState<Record<string, string>>({});
  const [newFieldType, setNewFieldType] = useState<Record<string, string>>({});

  // New option forms keyed by field id
  const [newOptionLabel, setNewOptionLabel] = useState<Record<string, string>>({});

  // no editingOption state needed — OptionRow manages its own state

  // Close menu when clicking outside the open menu
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  async function reload() {
    const sb_res = await fetch("/api/log-config/all", { headers: authHeader(), credentials: "include" });
    if (sb_res.ok) {
      const data = await sb_res.json();
      if (Array.isArray(data)) {
        // Auto-create the General (standard) type if it doesn't exist yet
        if (!data.find((t: LogEntryType) => t.slug === "standard")) {
          await fetch("/api/log-config", {
            method: "POST",
            headers: authHeader(), credentials: "include",
            body: JSON.stringify({ name: "General", slug: "standard", sort_order: -1, time_mode: "job", is_timed: true }),
          });
          await reload();
          return;
        }
        // Pin General at top, then sort rest by sort_order
        const sorted = data.slice().sort((a: LogEntryType, b: LogEntryType) => {
          if (a.slug === "standard") return -1;
          if (b.slug === "standard") return 1;
          return a.sort_order - b.sort_order;
        });
        setTypes(sorted);
        setLoading(false);
        return;
      }
    }
    const res = await fetch("/api/log-config");
    const data = await res.json();
    if (Array.isArray(data)) setTypes(data);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setWorkers(data.filter((w: Worker) => w.role === "worker")); })
      .catch(() => {});
  }, []);

  async function handleAddType() {
    if (!newTypeName.trim()) return;
    setAddingType(true);
    const slug = toSlug(newTypeName);
    const time_mode = newTypeTimed ? newTypePosition : "none";
    await fetch("/api/log-config", {
      method: "POST",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({
        name: newTypeName.trim(),
        slug,
        sort_order: types.length,
        time_mode,
        is_timed: newTypeTimed,
      }),
    });
    setNewTypeName("");
    setNewTypePosition("job");
    setNewTypeTimed(true);
    setAddingType(false);
    await reload();
  }

  const handleSaveFieldRate = useCallback(async (fieldId: string, rateType: string, rateAmount: string) => {
    await fetch("/api/log-config/fields", {
      method: "PUT",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({
        id: fieldId,
        rate_type: rateType || null,
        rate_amount: rateAmount !== "" ? parseFloat(rateAmount) : null,
      }),
    });
    await reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDeleteType(id: string) {
    if (!confirm("Delete this log type and all its fields? This cannot be undone.")) return;
    await fetch("/api/log-config", {
      method: "DELETE",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ id }),
    });
    if (expandedType === id) setExpandedType(null);
    await reload();
  }

  async function handleToggleActive(type: LogEntryType) {
    await fetch("/api/log-config", {
      method: "PUT",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ id: type.id, is_active: !type.is_active }),
    });
    await reload();
  }

  async function handleSetTimeMode(type: LogEntryType, mode: TimeMode) {
    // Optimistic update so the radio dot changes immediately
    setTypes((prev) =>
      prev.map((t) => t.id === type.id ? { ...t, time_mode: mode, is_timed: mode === "job" } : t)
    );
    await fetch("/api/log-config", {
      method: "PUT",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ id: type.id, time_mode: mode, is_timed: mode === "job" }),
    });
    await reload();
  }

  async function handleAddField(typeId: string) {
    const label = newFieldName[typeId]?.trim();
    const fieldType = newFieldType[typeId] || "text";
    if (!label) return;
    const type = types.find((t) => t.id === typeId);
    const sortOrder = type ? type.fields.length : 0;
    await fetch("/api/log-config/fields", {
      method: "POST",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({
        type_id: typeId,
        label,
        field_key: toSlug(label),
        field_type: fieldType,
        sort_order: sortOrder,
      }),
    });
    setNewFieldName((prev) => ({ ...prev, [typeId]: "" }));
    setNewFieldType((prev) => ({ ...prev, [typeId]: "text" }));
    await reload();
  }

  async function handleDeleteField(id: string) {
    if (!confirm("Delete this field and all its options?")) return;
    await fetch("/api/log-config/fields", {
      method: "DELETE",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ id }),
    });
    if (expandedField === id) setExpandedField(null);
    await reload();
  }

  async function handleAddOption(fieldId: string) {
    const label = newOptionLabel[fieldId]?.trim();
    if (!label) return;
    const field = types.flatMap((t) => t.fields).find((f) => f.id === fieldId);
    const sortOrder = field ? field.options.length : 0;
    await fetch("/api/log-config/options", {
      method: "POST",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ field_id: fieldId, label, sort_order: sortOrder }),
    });
    setNewOptionLabel((prev) => ({ ...prev, [fieldId]: "" }));
    await reload();
  }

  async function handleDeleteOption(id: string) {
    await fetch("/api/log-config/options", {
      method: "DELETE",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ id }),
    });
    await reload();
  }

  const handleSaveOption = useCallback(async (id: string, label: string, rateType: string, rateAmount: string) => {
    await fetch("/api/log-config/options", {
      method: "PUT",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({
        id,
        label,
        rate_type: rateType || null,
        rate_amount: rateAmount !== "" ? parseFloat(rateAmount) : null,
      }),
    });
    await reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log Entry Types</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define custom entry types that employees can choose when logging billable hours.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/admin/statistics"
            className="text-sm font-semibold text-navy-600 border border-navy-300 hover:bg-navy-50 rounded-lg px-3 py-2.5 md:py-1.5 transition-colors"
          >
            View Statistics
          </Link>
          <button
            onClick={() => setShowFormPreview(true)}
            className="text-sm font-semibold text-navy-600 border border-navy-300 hover:bg-navy-50 rounded-lg px-3 py-2.5 md:py-1.5 transition-colors"
          >
            Preview Form
          </button>
        </div>
      </div>

      {types.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No custom log types yet. Add one below.
        </div>
      )}

      {types.map((type) => {
        const isPrimary = type.slug === "standard";
        return (
        <div key={type.id} className={`bg-white rounded-xl border relative ${isPrimary ? "border-navy-300 ring-1 ring-navy-100" : "border-gray-200"}`}>
          {/* Type header */}
          <div className="flex items-center px-5 py-4 gap-2">
            <button
              type="button"
              className="flex items-center gap-3 text-left flex-1 min-w-0"
              onClick={() => setExpandedType(expandedType === type.id ? null : type.id)}
            >
              <span className="font-semibold text-gray-900 truncate">{type.name}</span>
              {isPrimary && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold bg-navy-600 text-white">Primary</span>
              )}
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${type.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {type.is_active ? "Active" : "Hidden"}
              </span>
              <span className="text-xs text-gray-400 ml-auto pr-2 shrink-0">
                {type.fields.length} field{type.fields.length !== 1 ? "s" : ""}
              </span>
              <span className="text-gray-400 text-sm shrink-0">{expandedType === type.id ? "▲" : "▼"}</span>
            </button>

            {/* Kebab menu */}
            <div ref={openMenu === type.id ? menuRef : undefined} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === type.id ? null : type.id)}
                className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ⋮
              </button>
              {openMenu === type.id && (
                <TypeActionsMenu
                  type={type}
                  isPrimary={isPrimary}
                  onSetTimeMode={(mode) => handleSetTimeMode(type, mode)}
                  onToggleActive={() => { setOpenMenu(null); handleToggleActive(type); }}
                  onDelete={() => { setOpenMenu(null); handleDeleteType(type.id); }}
                />
              )}
            </div>
          </div>

          {/* Expanded: fields */}
          {expandedType === type.id && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50 rounded-b-xl overflow-hidden">

              {isPrimary && <WorkerRatesSection type={type} workers={workers} />}

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fields</p>
                <button
                  type="button"
                  onClick={() => setPreviewType(type)}
                  className="text-xs border border-navy-300 text-navy-600 rounded-lg px-3 py-2 md:py-1 hover:bg-navy-50 transition-colors"
                >
                  Preview
                </button>
              </div>

              {type.fields.length === 0 && (
                <p className="text-sm text-gray-400">No fields yet. Add one below.</p>
              )}

              {type.fields
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    isTimed={type.time_mode !== "none"}
                    expanded={expandedField === field.id}
                    onToggle={() => setExpandedField(expandedField === field.id ? null : field.id)}
                    onDelete={() => handleDeleteField(field.id)}
                    newOptionLabel={newOptionLabel[field.id] ?? ""}
                    onNewOptionChange={(v) =>
                      setNewOptionLabel((prev) => ({ ...prev, [field.id]: v }))
                    }
                    onAddOption={() => handleAddOption(field.id)}
                    onDeleteOption={handleDeleteOption}
                    onSaveOption={handleSaveOption}
                    onSaveFieldRate={handleSaveFieldRate}
                  />
                ))}

              {/* Add field form */}
              <div className="flex flex-col gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Field name (e.g. From Location)"
                  value={newFieldName[type.id] ?? ""}
                  onChange={(e) =>
                    setNewFieldName((prev) => ({ ...prev, [type.id]: e.target.value }))
                  }
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddField(type.id); } }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
                <div className="flex gap-2">
                  <select
                    value={newFieldType[type.id] ?? "text"}
                    onChange={(e) =>
                      setNewFieldType((prev) => ({ ...prev, [type.id]: e.target.value }))
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white"
                  >
                    <option value="dropdown">Dropdown</option>
                    <option value="number">Number</option>
                    <option value="text">Text</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddField(type.id)}
                    className="shrink-0 bg-navy-600 hover:bg-navy-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                  >
                    Add Field
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })}

      {/* Add new type */}
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          New Log Type
        </p>

        {/* Name + submit */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Type name (e.g. Trucking)"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddType(); } }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          <button
            type="button"
            onClick={handleAddType}
            disabled={addingType || !newTypeName.trim()}
            className="shrink-0 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: NAVY }}
          >
            {addingType ? "Saving…" : "Add Type"}
          </button>
        </div>

        {/* Time placement: Per Job | General */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Time placement</p>
          <div className="flex gap-2">
            {(["job", "day"] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setNewTypePosition(pos)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={
                  newTypePosition === pos
                    ? { backgroundColor: NAVY, color: "#fff", borderColor: NAVY }
                    : { backgroundColor: "#fff", color: "#6b7280", borderColor: "#d1d5db" }
                }
              >
                {pos === "job" ? "Per Job" : "General"}
              </button>
            ))}
          </div>
        </div>

        {/* Timed toggle */}
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500">Timed</p>
          <button
            type="button"
            onClick={() => setNewTypeTimed((v) => !v)}
            className="w-9 h-5 rounded-full relative transition-colors"
            style={{ backgroundColor: newTypeTimed ? NAVY : "#d1d5db" }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
              style={{ transform: newTypeTimed ? "translateX(18px)" : "translateX(2px)" }}
            />
          </button>
          <span className="text-xs text-gray-400">{newTypeTimed ? "On" : "Off"}</span>
        </div>
      </div>

      {previewType && (
        <PreviewModal type={previewType} allTypes={types} onClose={() => setPreviewType(null)} />
      )}

      {showFormPreview && (
        <div className="fixed inset-x-0 bottom-0 top-[63px] z-50 bg-black/60 flex flex-col">
          <div className="flex items-center justify-between bg-white border-b border-gray-200 px-5 py-4 shrink-0">
            <span className="font-semibold text-gray-900">Employee Form Preview</span>
            <button
              onClick={() => setShowFormPreview(false)}
              className="text-gray-400 hover:text-gray-600 px-1 flex items-center"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
            </button>
          </div>
          <div className="text-xs text-gray-400 italic bg-gray-50 px-5 py-2 border-b border-gray-100 shrink-0">
            This is exactly what employees see. No data will be submitted.
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-100 px-4 py-6">
            <div className="max-w-lg mx-auto">
              <TimesheetForm previewMode />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WorkerRatesSection ─────────────────────────────────────────────────────

function RateCell({ workerId, rate, onSave }: {
  workerId: string;
  rate: number | null;
  onSave: (workerId: string, rateAmount: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rate != null ? String(rate) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(rate != null ? String(rate) : "");
  }, [rate]);

  async function commit() {
    setEditing(false);
    const parsed = value.trim() === "" ? null : parseFloat(value);
    if (parsed === rate) return;
    setSaving(true);
    await onSave(workerId, parsed != null && !isNaN(parsed) ? parsed : null);
    setSaving(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(rate != null ? String(rate) : ""); setEditing(false); } }}
        placeholder="0.00"
        className="w-24 border border-navy-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-navy-400"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to set the rate charged to the client for this worker's General hours"
      className="text-sm text-right tabular-nums hover:text-navy-700 transition-colors"
    >
      {saving ? (
        <span className="text-gray-400">…</span>
      ) : rate != null ? (
        <span className="text-gray-900">${rate.toFixed(2)}<span className="text-gray-400">/hr</span></span>
      ) : (
        <span className="text-gray-300 italic">Not set</span>
      )}
    </button>
  );
}

function WorkerRatesSection({ type, workers }: { type: LogEntryType; workers: { id: string; full_name: string }[] }) {
  const [rates, setRates] = useState<TypeWorkerRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/log-config/type-worker-rates?type_id=${type.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRates(data); })
      .finally(() => setLoading(false));
  }, [type.id]);

  async function saveRate(workerId: string, rateAmount: number | null) {
    const res = await fetch("/api/log-config/type-worker-rates", {
      method: "PUT",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ type_id: type.id, worker_id: workerId, rate_amount: rateAmount }),
    });
    if (!res.ok) return;
    setRates((prev) => {
      const withoutWorker = prev.filter((r) => r.worker_id !== workerId);
      return rateAmount == null
        ? withoutWorker
        : [...withoutWorker, { id: `${type.id}-${workerId}`, type_id: type.id, worker_id: workerId, rate_amount: rateAmount }];
    });
  }

  if (workers.length === 0) return null;

  return (
    <div className="bg-white border border-navy-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-navy-700">Client billing rate — per worker</p>
      <p className="text-xs text-gray-400">
        What to charge the client per hour of General work for each worker.
      </p>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {workers.map((w) => (
            <div key={w.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-700">{w.full_name}</span>
              <RateCell
                workerId={w.id}
                rate={rates.find((r) => r.worker_id === w.id)?.rate_amount ?? null}
                onSave={saveRate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TypeActionsMenu ─────────────────────────────────────────────────────────

interface TypeActionsMenuProps {
  type: LogEntryType;
  isPrimary?: boolean;
  onSetTimeMode: (mode: TimeMode) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function TypeActionsMenu({ type, isPrimary, onSetTimeMode, onToggleActive, onDelete }: TypeActionsMenuProps) {
  const currentMode: TimeMode = (type.time_mode as TimeMode) ?? (type.is_timed ? "job" : "none");
  const isTimed = currentMode !== "none";
  const [positionMode, setPositionMode] = useState<"job" | "day">(
    currentMode === "none" ? "job" : (currentMode as "job" | "day")
  );

  function handlePositionChange(pos: "job" | "day") {
    setPositionMode(pos);
    if (isTimed) onSetTimeMode(pos);
  }

  function handleTimedToggle() {
    onSetTimeMode(isTimed ? "none" : positionMode);
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-56 overflow-hidden">
      {/* Time placement */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Time placement</p>
        <div className="flex gap-2">
          {(["job", "day"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => handlePositionChange(pos)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={
                positionMode === pos
                  ? { backgroundColor: NAVY, color: "#fff", borderColor: NAVY }
                  : { backgroundColor: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }
              }
            >
              {pos === "job" ? "Per Job" : "General"}
            </button>
          ))}
        </div>
      </div>

      {/* Timed toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <span className="text-sm text-gray-700">Timed</span>
        <button
          type="button"
          onClick={handleTimedToggle}
          className="w-9 h-5 rounded-full relative transition-colors"
          style={{ backgroundColor: isTimed ? NAVY : "#d1d5db" }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
            style={{ transform: isTimed ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <div className="border-t border-gray-100" />
      <button
        type="button"
        onClick={onToggleActive}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {type.is_active ? "Hide type" : "Show type"}
      </button>
      {!isPrimary && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
        >
          Delete type
        </button>
      )}
    </div>
  );
}

// ─── PreviewModal ─────────────────────────────────────────────────────────────

interface PreviewModalProps {
  type: LogEntryType;
  allTypes: LogEntryType[];
  onClose: () => void;
}

function PreviewModal({ type, allTypes, onClose }: PreviewModalProps) {
  const [entry, setEntry] = useState<BillableEntryData>({
    id: "preview",
    client: "",
    description: "",
    startTime: "",
    endTime: "",
    entryType: type.slug,
    customFields: {},
    _typeData: {},
    photos: [],
  });

  const jobTypes = allTypes.filter((t) => t.time_mode !== "day");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-900">Employee preview</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex items-center"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
          </button>
        </div>
        <div className="text-xs text-gray-400 italic bg-gray-50 px-5 py-2 border-b border-gray-100">
          Showing how a job entry appears to employees. Changes are not saved.
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
          <BillableEntry
            entry={entry}
            onChange={setEntry}
            onRemove={() => {}}
            showRemove={false}
            entryTypes={jobTypes}
          />
        </div>
      </div>
    </div>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: LogEntryField;
  isTimed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  newOptionLabel: string;
  onNewOptionChange: (v: string) => void;
  onAddOption: () => void;
  onDeleteOption: (id: string) => void;
  onSaveOption: (id: string, label: string, rateType: string, rateAmount: string) => void;
  onSaveFieldRate: (id: string, rateType: string, rateAmount: string) => void;
}

// ─── OptionRow ────────────────────────────────────────────────────────────────
// Manages its own local state; saves to DB on blur when anything changed.

function OptionRow({ opt, isTimed, onSave, onDelete }: {
  opt: LogEntryFieldOption;
  isTimed: boolean;
  onSave: (id: string, label: string, rateType: string, rateAmount: string) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState(opt.label);
  // If the type is not timed and a per_hour rate was somehow saved, treat it as no rate
  const [rateType, setRateType] = useState<string>(!isTimed && opt.rate_type === "per_hour" ? "" : (opt.rate_type ?? ""));
  const [rateAmount, setRateAmount] = useState<string>(opt.rate_amount != null ? String(opt.rate_amount) : "");

  useEffect(() => {
    setLabel(opt.label);
    setRateType(!isTimed && opt.rate_type === "per_hour" ? "" : (opt.rate_type ?? ""));
    setRateAmount(opt.rate_amount != null ? String(opt.rate_amount) : "");
  }, [opt.label, opt.rate_type, opt.rate_amount, isTimed]);

  function save() {
    const origRate = opt.rate_type ?? "";
    const origAmount = opt.rate_amount != null ? String(opt.rate_amount) : "";
    if (label.trim() !== opt.label || rateType !== origRate || rateAmount !== origAmount) {
      onSave(opt.id, label.trim() || opt.label, rateType, rateAmount);
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
        className="flex-1 min-w-[80px] border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-navy-400 focus:border-navy-400"
        placeholder="Option label"
      />
      <select
        value={rateType}
        onChange={(e) => { setRateType(e.target.value); if (!e.target.value) setRateAmount(""); }}
        onBlur={save}
        className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-navy-400"
      >
        <option value="">No rate</option>
        {isTimed && <option value="per_hour">$/hr</option>}
        <option value="per_unit">$/unit</option>
      </select>
      {rateType && (
        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-400">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={rateAmount}
            onChange={(e) => setRateAmount(e.target.value)}
            onBlur={save}
            className="w-16 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
            placeholder="0.00"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => onDelete(opt.id)}
        className="text-red-400 hover:text-red-600 flex items-center shrink-0 ml-auto"
        title="Remove option"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
      </button>
    </div>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  isTimed,
  expanded,
  onToggle,
  onDelete,
  newOptionLabel,
  onNewOptionChange,
  onAddOption,
  onDeleteOption,
  onSaveOption,
  onSaveFieldRate,
}: FieldRowProps) {
  const [numRateType, setNumRateType] = useState<string>(field.rate_type ?? "");
  const [numRateAmount, setNumRateAmount] = useState<string>(field.rate_amount != null ? String(field.rate_amount) : "");

  useEffect(() => {
    setNumRateType(field.rate_type ?? "");
    setNumRateAmount(field.rate_amount != null ? String(field.rate_amount) : "");
  }, [field.rate_type, field.rate_amount]);

  function saveNumRate() {
    const origType = field.rate_type ?? "";
    const origAmount = field.rate_amount != null ? String(field.rate_amount) : "";
    if (numRateType !== origType || numRateAmount !== origAmount) {
      onSaveFieldRate(field.id, numRateType, numRateAmount);
    }
  }

  const typeLabel =
    field.field_type === "dropdown" ? "Dropdown"
    : field.field_type === "number" ? "Number"
    : "Text";

  const typeBadgeColor =
    field.field_type === "dropdown" ? "bg-purple-100 text-purple-700"
    : field.field_type === "number" ? "bg-amber-100 text-amber-700"
    : "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {field.field_type === "dropdown" ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-3 flex-1 text-left min-w-0"
          >
            <span className="text-sm font-medium text-gray-800">{field.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor}`}>
              {typeLabel}
            </span>
            <span className="text-xs text-gray-400">
              {field.options.length} option{field.options.length !== 1 ? "s" : ""}
            </span>
            <span className="text-gray-400 text-sm ml-auto">{expanded ? "▲" : "▼"}</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800">{field.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor}`}>
              {typeLabel}
            </span>
          </div>
        )}
        <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 shrink-0">
          Remove
        </button>
      </div>

      {/* Inline rate inputs for number fields */}
      {field.field_type === "number" && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 shrink-0">Rate:</span>
          <select
            value={numRateType}
            onChange={(e) => { setNumRateType(e.target.value); if (!e.target.value) setNumRateAmount(""); }}
            onBlur={saveNumRate}
            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-navy-400"
          >
            <option value="">No rate</option>
            <option value="per_hour">Per hour</option>
            <option value="per_unit">Per unit</option>
          </select>
          {numRateType && (
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={numRateAmount}
                onChange={(e) => setNumRateAmount(e.target.value)}
                onBlur={saveNumRate}
                className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
                placeholder="0.00"
              />
            </div>
          )}
          {field.rate_amount != null && field.rate_type && (
            <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 ml-1">
              ${field.rate_amount}/{field.rate_type === "per_hour" ? "hr" : "unit"}
            </span>
          )}
        </div>
      )}

      {/* Options list — always-editable inline rows */}
      {field.field_type === "dropdown" && expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
          {field.options.length > 0 && (
            <div className="flex items-center gap-1.5 pb-0.5">
              <span className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Option</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Rate type</span>
              <span className="w-16 text-[10px] font-semibold text-gray-400 uppercase tracking-wide pl-3.5">Amount</span>
            </div>
          )}
          {field.options.length === 0 && (
            <p className="text-xs text-gray-400">No options yet.</p>
          )}
          {field.options
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((opt) => (
              <OptionRow
                key={opt.id}
                opt={opt}
                isTimed={isTimed}
                onSave={onSaveOption}
                onDelete={onDeleteOption}
              />
            ))}

          <div className="flex gap-2 pt-1 border-t border-gray-200 mt-1">
            <input
              type="text"
              placeholder="New option…"
              value={newOptionLabel}
              onChange={(e) => onNewOptionChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddOption(); } }}
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
            <button
              type="button"
              onClick={onAddOption}
              className="bg-navy-600 hover:bg-navy-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
