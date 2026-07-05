"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { LogEntryType } from "@/types/logConfig";

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface SubEntry {
  id: string;
  slug: string;
  customFields?: Record<string, string>;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

// Kept for backward compat with data stored before the sub-entry redesign
interface TypeSnapshot {
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

export interface BillableEntryData {
  id: string;
  client: string;
  description: string;
  startTime: string;
  endTime: string;
  manualHours?: number;
  customFields?: Record<string, string>;
  subEntries?: SubEntry[];
  photos?: string[];
  linkedEventId?: string;
  linkedEventTitle?: string;
  // Kept for backward compat with old stored submissions:
  entryType?: string;
  _typeData?: Record<string, TypeSnapshot>;
}

function hoursDisplay(start?: string, end?: string, manual?: number): string {
  if (manual != null) return `${manual}h`;
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return "";
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
  onLinkJob?: () => void;
  jobNumber?: number;
}

export default function BillableEntry({ entry, onChange, onRemove, showRemove, entryTypes, onLinkJob, jobNumber }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);

  const subEntries = entry.subEntries ?? [];
  const standardType = entryTypes.find((t) => t.slug === "standard");
  const customTypes = entryTypes.filter((t) => t.slug !== "standard");
  const hasCustomTypes = customTypes.length > 0;

  const activeSub = activeSubId ? (subEntries.find((s) => s.id === activeSubId) ?? null) : null;
  const activeCustomType = activeSub ? entryTypes.find((t) => t.slug === activeSub.slug) : null;

  const effectiveTimeMode = activeSub
    ? (activeCustomType?.time_mode ?? (activeCustomType?.is_timed !== false ? "job" : "none"))
    : "job";
  const showTime = effectiveTimeMode !== "none";

  const generalHours = hoursDisplay(entry.startTime, entry.endTime, entry.manualHours);
  const generalName = standardType?.name ?? "General";

  const update = (field: keyof BillableEntryData, value: string) =>
    onChange({ ...entry, [field]: value });

  const updateCustomField = (key: string, value: string) =>
    onChange({ ...entry, customFields: { ...(entry.customFields ?? {}), [key]: value } });

  const updateSubEntry = (id: string, patch: Partial<SubEntry>) =>
    onChange({
      ...entry,
      subEntries: subEntries.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const updateSubCustomField = (id: string, key: string, value: string) => {
    const sub = subEntries.find((s) => s.id === id);
    if (!sub) return;
    updateSubEntry(id, { customFields: { ...(sub.customFields ?? {}), [key]: value } });
  };

  const addSubEntry = (slug: string) => {
    const id = uuid();
    onChange({
      ...entry,
      subEntries: [...subEntries, { id, slug, customFields: {}, startTime: "", endTime: "" }],
    });
    setActiveSubId(id);
  };

  const removeSubEntry = (id: string) => {
    onChange({ ...entry, subEntries: subEntries.filter((s) => s.id !== id) });
    if (activeSubId === id) setActiveSubId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${entry.id}/${Date.now()}-${safeName}`;
        const { error } = await createSupabaseBrowser().storage.from("job-photos").upload(path, file);
        if (error) throw error;
        const { data } = createSupabaseBrowser().storage.from("job-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      onChange({ ...entry, photos: [...(entry.photos ?? []), ...urls] });
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (url: string) =>
    onChange({ ...entry, photos: (entry.photos ?? []).filter((p) => p !== url) });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-navy-600 uppercase tracking-wide">
          {jobNumber != null ? `Job ${jobNumber}` : "Job"}
        </span>
        <div className="flex items-center gap-2">
          {generalHours && (
            <span className="text-sm font-semibold text-gray-700 bg-navy-50 px-2 py-0.5 rounded-full">
              {generalHours}
            </span>
          )}
          {onLinkJob && (
            <button
              type="button"
              onClick={onLinkJob}
              className="text-xs text-navy-500 border border-navy-200 rounded-lg px-2 py-0.5 hover:bg-navy-50 transition-colors"
            >
              <svg className="inline w-3 h-3 mr-1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95l-.87.87"/><path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-1.5 1.5a3.5 3.5 0 0 0 4.95 4.95l.87-.87"/></svg>Link to schedule
            </button>
          )}
          {showRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-red-400 hover:text-red-600 leading-none"
              aria-label="Remove entry"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Linked event pill */}
      {entry.linkedEventId && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-green-700 font-medium flex-1 min-w-0 truncate">
            <svg className="inline w-3 h-3 mr-1 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95l-.87.87"/><path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-1.5 1.5a3.5 3.5 0 0 0 4.95 4.95l.87-.87"/></svg>{entry.linkedEventTitle ?? "Linked event"}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...entry, linkedEventId: undefined, linkedEventTitle: undefined })}
            className="text-green-400 hover:text-green-600 leading-none shrink-0"
            aria-label="Unlink event"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
          </button>
        </div>
      )}

      {/* Tab strip — General + added sub-entries */}
      {(hasCustomTypes || subEntries.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {/* General tab */}
          <button
            type="button"
            onClick={() => setActiveSubId(null)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors flex items-center gap-1.5 ${
              activeSubId === null
                ? "bg-navy-600 text-white border-navy-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-navy-300"
            }`}
          >
            <span>{generalName}</span>
            {generalHours && (
              <span className={`text-xs font-bold ${activeSubId === null ? "opacity-80" : "text-navy-600"}`}>
                {generalHours}
              </span>
            )}
          </button>

          {/* Added sub-entry tabs */}
          {subEntries.map((sub) => {
            const subType = entryTypes.find((t) => t.slug === sub.slug);
            const subHours = hoursDisplay(sub.startTime, sub.endTime, sub.manualHours);
            const isActive = activeSubId === sub.id;
            return (
              <div
                key={sub.id}
                className={`flex items-center rounded-xl border-2 transition-colors ${
                  isActive ? "bg-navy-600 border-navy-600" : "bg-white border-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveSubId(sub.id)}
                  className={`pl-3 pr-1.5 py-2 text-sm font-semibold flex items-center gap-1.5 ${
                    isActive ? "text-white" : "text-gray-600"
                  }`}
                >
                  <span>{subType?.name ?? sub.slug}</span>
                  {subHours && (
                    <span className={`text-xs font-bold ${isActive ? "opacity-80" : "text-navy-600"}`}>
                      {subHours}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeSubEntry(sub.id)}
                  aria-label="Remove"
                  className={`pr-2.5 py-2 leading-none flex items-center ${
                    isActive ? "text-white/60 hover:text-white" : "text-gray-300 hover:text-red-400"
                  }`}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Form fields — General tab */}
      {activeSubId === null && (
        <>
          <input
            type="text"
            placeholder="Customer / Client name"
            value={entry.client}
            onChange={(e) => update("client", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          <input
            type="text"
            placeholder="Job description"
            value={entry.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          {standardType?.fields
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((field) => (
              <div key={field.id}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                {field.field_type === "dropdown" ? (
                  <select
                    value={entry.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateCustomField(field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white"
                  >
                    <option value="">Select {field.label.toLowerCase()}…</option>
                    {field.options
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((opt) => (
                        <option key={opt.id} value={opt.label}>{opt.label}</option>
                      ))}
                  </select>
                ) : field.field_type === "number" ? (
                  <input
                    type="number" min="0" step="1" placeholder="0"
                    value={entry.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateCustomField(field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                ) : (
                  <input type="text"
                    value={entry.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateCustomField(field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                )}
              </div>
            ))}
        </>
      )}

      {/* Form fields — Sub-entry tab */}
      {activeSub && activeCustomType && (
        <div className="space-y-3">
          {activeCustomType.fields
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((field) => (
              <div key={field.id}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                {field.field_type === "dropdown" ? (
                  <select
                    value={activeSub.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateSubCustomField(activeSub.id, field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white"
                  >
                    <option value="">Select {field.label.toLowerCase()}…</option>
                    {field.options
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((opt) => (
                        <option key={opt.id} value={opt.label}>{opt.label}</option>
                      ))}
                  </select>
                ) : field.field_type === "number" ? (
                  <input
                    type="number" min="0" step="1" placeholder="0"
                    value={activeSub.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateSubCustomField(activeSub.id, field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                ) : (
                  <input type="text"
                    value={activeSub.customFields?.[field.field_key] ?? ""}
                    onChange={(e) => updateSubCustomField(activeSub.id, field.field_key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                )}
              </div>
            ))}
        </div>
      )}

      {/* Time row */}
      {showTime && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start time</label>
              <div className="overflow-x-hidden rounded-lg">
                <input
                  type="time"
                  size={1}
                  value={activeSub ? (activeSub.startTime ?? "") : entry.startTime}
                  onChange={(e) =>
                    activeSub
                      ? updateSubEntry(activeSub.id, { startTime: e.target.value })
                      : update("startTime", e.target.value)
                  }
                  className="w-full min-w-0 border border-gray-300 rounded-lg px-2 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-navy-400 appearance-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End time</label>
              <div className="overflow-x-hidden rounded-lg">
                <input
                  type="time"
                  size={1}
                  value={activeSub ? (activeSub.endTime ?? "") : entry.endTime}
                  onChange={(e) =>
                    activeSub
                      ? updateSubEntry(activeSub.id, { endTime: e.target.value })
                      : update("endTime", e.target.value)
                  }
                  className="w-full min-w-0 border border-gray-300 rounded-lg px-2 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-navy-400 appearance-none"
                />
              </div>
            </div>
          </div>
          <div className="w-28">
            <label className="block text-xs text-gray-500 mb-1">Hours (manual)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="—"
              value={activeSub ? (activeSub.manualHours ?? "") : (entry.manualHours ?? "")}
              onChange={(e) => {
                const val = e.target.value !== "" ? parseFloat(e.target.value) : undefined;
                if (activeSub) {
                  updateSubEntry(activeSub.id, { manualHours: val });
                } else {
                  onChange({ ...entry, manualHours: val });
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-2 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-navy-400 text-center"
            />
          </div>
        </div>
      )}

      {/* Add sub-type pills */}
      {hasCustomTypes && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium shrink-0">Add:</span>
          {customTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => addSubEntry(t.slug)}
              className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-full px-2.5 py-0.5 hover:border-navy-400 hover:text-navy-600 transition-colors"
            >
              + {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Photos */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-wrap gap-2 items-center">
          {(entry.photos ?? []).map((url) => (
            <div key={url} className="relative shrink-0">
              <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/></svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:text-navy-500 hover:border-navy-400 transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {uploading ? "Uploading…" : "Add photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
