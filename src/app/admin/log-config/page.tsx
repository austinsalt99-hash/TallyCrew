"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import type { LogEntryType, LogEntryField, LogEntryFieldOption } from "@/types/logConfig";

function authHeader() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export default function LogConfigPage() {
  const [types, setTypes] = useState<LogEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedField, setExpandedField] = useState<string | null>(null);

  // New type form
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeIsTimed, setNewTypeIsTimed] = useState(true);
  const [addingType, setAddingType] = useState(false);

  // New field forms keyed by type id
  const [newFieldName, setNewFieldName] = useState<Record<string, string>>({});
  const [newFieldType, setNewFieldType] = useState<Record<string, string>>({});

  // New option forms keyed by field id
  const [newOptionLabel, setNewOptionLabel] = useState<Record<string, string>>({});

  // Edit-in-place for option labels
  const [editingOption, setEditingOption] = useState<{ id: string; label: string } | null>(null);

  async function reload() {
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
      headers: authHeader(),
      body: JSON.stringify({ name: newTypeName.trim(), slug, sort_order: types.length, is_timed: newTypeIsTimed }),
    });
    setNewTypeName("");
    setNewTypeIsTimed(true);
    setAddingType(false);
    await reload();
  }

  async function handleDeleteType(id: string) {
    if (!confirm("Delete this log type and all its fields? This cannot be undone.")) return;
    await fetch("/api/log-config", {
      method: "DELETE",
      headers: authHeader(),
      body: JSON.stringify({ id }),
    });
    if (expandedType === id) setExpandedType(null);
    await reload();
  }

  async function handleToggleActive(type: LogEntryType) {
    await fetch("/api/log-config", {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({ id: type.id, is_active: !type.is_active }),
    });
    await reload();
  }

  async function handleToggleTimed(type: LogEntryType) {
    await fetch("/api/log-config", {
      method: "PUT",
      headers: authHeader(),
      body: JSON.stringify({ id: type.id, is_timed: !type.is_timed }),
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
      headers: authHeader(),
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
      headers: authHeader(),
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
      headers: authHeader(),
      body: JSON.stringify({ field_id: fieldId, label, sort_order: sortOrder }),
    });
    setNewOptionLabel((prev) => ({ ...prev, [fieldId]: "" }));
    await reload();
  }

  async function handleDeleteOption(id: string) {
    await fetch("/api/log-config/options", {
      method: "DELETE",
      headers: authHeader(),
      body: JSON.stringify({ id }),
    });
    await reload();
  }

  async function handleSaveOptionEdit() {
    if (!editingOption) return;
    await fetch("/api/log-config/options", {
      method: "PUT",
      headers: authHeader(),
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log Entry Types</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define custom entry types that employees can choose when logging billable hours.
        </p>
      </div>

      {types.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No custom log types yet. Add one below.
        </div>
      )}

      {types.map((type) => (
        <div key={type.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Type header */}
          <div className="flex items-center justify-between px-5 py-4">
            <button
              type="button"
              className="flex items-center gap-3 text-left flex-1 min-w-0"
              onClick={() => setExpandedType(expandedType === type.id ? null : type.id)}
            >
              <span className="font-semibold text-gray-900">{type.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {type.is_active ? "Active" : "Hidden"}
              </span>
              <span className="text-xs text-gray-400 ml-auto pr-2">
                {type.fields.length} field{type.fields.length !== 1 ? "s" : ""}
              </span>
              <span className="text-gray-400 text-sm">{expandedType === type.id ? "▲" : "▼"}</span>
            </button>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleTimed(type)}
                className={`text-xs border rounded-lg px-3 py-1.5 ${type.is_timed ? "text-blue-600 border-blue-200 hover:border-blue-400" : "text-gray-500 border-gray-300 hover:text-gray-700"}`}
                title={type.is_timed ? "Currently tracks start/end time — click to disable" : "Currently no time tracking — click to enable"}
              >
                {type.is_timed ? "Timed" : "Not timed"}
              </button>
              <button
                type="button"
                onClick={() => handleToggleActive(type)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5"
              >
                {type.is_active ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteType(type.id)}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Expanded: fields */}
          {expandedType === type.id && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fields</p>

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
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Field name (e.g. From Location)"
                  value={newFieldName[type.id] ?? ""}
                  onChange={(e) =>
                    setNewFieldName((prev) => ({ ...prev, [type.id]: e.target.value }))
                  }
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddField(type.id); } }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <select
                  value={newFieldType[type.id] ?? "text"}
                  onChange={(e) =>
                    setNewFieldType((prev) => ({ ...prev, [type.id]: e.target.value }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="dropdown">Dropdown</option>
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleAddField(type.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  Add Field
                </button>
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
        <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={newTypeIsTimed}
            onChange={(e) => setNewTypeIsTimed(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-gray-600">Track start/end time for this entry type</span>
        </label>
      </div>
    </div>
  );
}

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
