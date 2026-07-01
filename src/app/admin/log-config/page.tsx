"use client";

import { useEffect, useRef, useState } from "react";
import BillableEntry, { BillableEntryData } from "@/components/BillableEntry";
import TimesheetForm from "@/components/TimesheetForm";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

function authHeader() {
  return { "Content-Type": "application/json" };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

type TimeMode = "job" | "day" | "none";
const TIME_MODE_LABELS: Record<TimeMode, string> = { job: "Per job", day: "General", none: "No time" };

export default function LogConfigPage() {
  const [types, setTypes] = useState<LogEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<LogEntryType | null>(null);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // New type form
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeTimeMode, setNewTypeTimeMode] = useState<TimeMode>("job");
  const [addingType, setAddingType] = useState(false);

  // New field forms keyed by type id
  const [newFieldName, setNewFieldName] = useState<Record<string, string>>({});
  const [newFieldType, setNewFieldType] = useState<Record<string, string>>({});

  // New option forms keyed by field id
  const [newOptionLabel, setNewOptionLabel] = useState<Record<string, string>>({});

  // Edit-in-place for option labels
  const [editingOption, setEditingOption] = useState<{ id: string; label: string } | null>(null);

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
    // Fetch all types (including inactive) for the admin view
    const sb_res = await fetch("/api/log-config/all", { headers: authHeader(), credentials: "include" });
    if (sb_res.ok) {
      const data = await sb_res.json();
      if (Array.isArray(data)) { setTypes(data); setLoading(false); return; }
    }
    // Fallback to public endpoint
    const res = await fetch("/api/log-config");
    const data = await res.json();
    if (Array.isArray(data)) setTypes(data);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function handleAddType() {
    if (!newTypeName.trim()) return;
    setAddingType(true);
    const slug = toSlug(newTypeName);
    await fetch("/api/log-config", {
      method: "POST",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({
        name: newTypeName.trim(),
        slug,
        sort_order: types.length,
        time_mode: newTypeTimeMode,
        is_timed: newTypeTimeMode === "job",
      }),
    });
    setNewTypeName("");
    setNewTypeTimeMode("job");
    setAddingType(false);
    await reload();
  }

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

  async function handleSaveOptionEdit() {
    if (!editingOption) return;
    await fetch("/api/log-config/options", {
      method: "PUT",
      headers: authHeader(), credentials: "include",
      body: JSON.stringify({ id: editingOption.id, label: editingOption.label }),
    });
    setEditingOption(null);
    await reload();
  }

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
        <button
          onClick={() => setShowFormPreview(true)}
          className="shrink-0 text-sm font-semibold text-blue-600 border border-blue-300 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          Preview Form
        </button>
      </div>

      {types.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No custom log types yet. Add one below.
        </div>
      )}

      {types.map((type) => (
        <div key={type.id} className="bg-white rounded-xl border border-gray-200 relative">
          {/* Type header */}
          <div className="flex items-center px-5 py-4 gap-2">
            <button
              type="button"
              className="flex items-center gap-3 text-left flex-1 min-w-0"
              onClick={() => setExpandedType(expandedType === type.id ? null : type.id)}
            >
              <span className="font-semibold text-gray-900 truncate">{type.name}</span>
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
                className="w-8 h-8 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ⋮
              </button>
              {openMenu === type.id && (
                <TypeActionsMenu
                  type={type}
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
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fields</p>
                <button
                  type="button"
                  onClick={() => setPreviewType(type)}
                  className="text-xs border border-blue-300 text-blue-600 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors"
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
                    expanded={expandedField === field.id}
                    onToggle={() => setExpandedField(expandedField === field.id ? null : field.id)}
                    onDelete={() => handleDeleteField(field.id)}
                    newOptionLabel={newOptionLabel[field.id] ?? ""}
                    onNewOptionChange={(v) =>
                      setNewOptionLabel((prev) => ({ ...prev, [field.id]: v }))
                    }
                    onAddOption={() => handleAddOption(field.id)}
                    onDeleteOption={handleDeleteOption}
                    editingOption={editingOption}
                    onStartEdit={(opt) => setEditingOption({ id: opt.id, label: opt.label })}
                    onEditChange={(label) =>
                      setEditingOption((prev) => (prev ? { ...prev, label } : prev))
                    }
                    onSaveEdit={handleSaveOptionEdit}
                    onCancelEdit={() => setEditingOption(null)}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex gap-2">
                  <select
                    value={newFieldType[type.id] ?? "text"}
                    onChange={(e) =>
                      setNewFieldType((prev) => ({ ...prev, [type.id]: e.target.value }))
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  >
                    <option value="dropdown">Dropdown</option>
                    <option value="number">Number</option>
                    <option value="text">Text</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddField(type.id)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                  >
                    Add Field
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new type */}
      <div className="bg-white rounded-xl border border-dashed border-blue-300 p-5">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">
          New Log Type
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type name (e.g. Trucking)"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddType(); } }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={handleAddType}
            disabled={addingType || !newTypeName.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-5 py-2 rounded-lg"
          >
            {addingType ? "Saving…" : "Add Type"}
          </button>
        </div>
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Time tracking</p>
          <div className="flex gap-2">
            {(["job", "day", "none"] as TimeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setNewTypeTimeMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  newTypeTimeMode === mode
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-500 border-gray-300 hover:border-blue-400"
                }`}
              >
                {TIME_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
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
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
            >
              ×
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

// ─── TypeActionsMenu ─────────────────────────────────────────────────────────

interface TypeActionsMenuProps {
  type: LogEntryType;
  onSetTimeMode: (mode: TimeMode) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function TypeActionsMenu({ type, onSetTimeMode, onToggleActive, onDelete }: TypeActionsMenuProps) {
  const currentMode: TimeMode = (type.time_mode as TimeMode) ?? (type.is_timed ? "job" : "none");

  return (
    <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-52 py-1 overflow-hidden">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-2 pb-1">
        Time tracking
      </p>
      {(["job", "day", "none"] as TimeMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSetTimeMode(mode)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className={`w-3 h-3 rounded-full border shrink-0 ${currentMode === mode ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`} />
          {TIME_MODE_LABELS[mode]}
        </button>
      ))}
      <div className="border-t border-gray-100 my-1" />
      <button
        type="button"
        onClick={onToggleActive}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {type.is_active ? "Hide type" : "Show type"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
      >
        Delete type
      </button>
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
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
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
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  newOptionLabel: string;
  onNewOptionChange: (v: string) => void;
  onAddOption: () => void;
  onDeleteOption: (id: string) => void;
  editingOption: { id: string; label: string } | null;
  onStartEdit: (opt: LogEntryFieldOption) => void;
  onEditChange: (label: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

function FieldRow({
  field,
  expanded,
  onToggle,
  onDelete,
  newOptionLabel,
  onNewOptionChange,
  onAddOption,
  onDeleteOption,
  editingOption,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
}: FieldRowProps) {
  const typeLabel =
    field.field_type === "dropdown"
      ? "Dropdown"
      : field.field_type === "number"
      ? "Number"
      : "Text";

  const typeBadgeColor =
    field.field_type === "dropdown"
      ? "bg-purple-100 text-purple-700"
      : field.field_type === "number"
      ? "bg-amber-100 text-amber-700"
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
            {field.field_type === "dropdown" && (
              <span className="text-xs text-gray-400">
                {field.options.length} option{field.options.length !== 1 ? "s" : ""}
              </span>
            )}
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
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 shrink-0"
        >
          Remove
        </button>
      </div>

      {/* Options list for dropdown fields */}
      {field.field_type === "dropdown" && expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
          {field.options.length === 0 && (
            <p className="text-xs text-gray-400">No options yet.</p>
          )}
          {field.options
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                {editingOption?.id === opt.id ? (
                  <>
                    <input
                      type="text"
                      value={editingOption.label}
                      onChange={(e) => onEditChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSaveEdit(); } if (e.key === "Escape") onCancelEdit(); }}
                      className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
                      autoFocus
                    />
                    <button type="button" onClick={onSaveEdit} className="text-xs text-blue-600 font-semibold">Save</button>
                    <button type="button" onClick={onCancelEdit} className="text-xs text-gray-400">Cancel</button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                      onClick={() => onStartEdit(opt)}
                      title="Click to edit"
                    >
                      {opt.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteOption(opt.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="New option…"
              value={newOptionLabel}
              onChange={(e) => onNewOptionChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddOption(); } }}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={onAddOption}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
