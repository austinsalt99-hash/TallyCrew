"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { LogEntryType } from "@/types/logConfig";

interface TypeSnapshot {
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
}

export interface BillableEntryData {
  id: string;
  client: string;
  description: string;
  startTime: string;
  endTime: string;
  entryType?: string;
  customFields?: Record<string, string>;
  _typeData?: Record<string, TypeSnapshot>;
  photos?: string[];
  linkedEventId?: string;
  linkedEventTitle?: string;
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
  onLinkJob?: () => void;
}

export default function BillableEntry({ entry, onChange, onRemove, showRemove, entryTypes, onLinkJob }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const update = (field: keyof BillableEntryData, value: string) =>
    onChange({ ...entry, [field]: value });

  const updateCustomField = (key: string, value: string) =>
    onChange({ ...entry, customFields: { ...(entry.customFields ?? {}), [key]: value } });

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

  const selectType = (slug: string) => {
    const currentSlug = entry.entryType ?? "standard";
    const saved = entry._typeData?.[slug] ?? {};
    onChange({
      ...entry,
      entryType: slug,
      client: saved.client ?? "",
      description: saved.description ?? "",
      customFields: saved.customFields ?? {},
      _typeData: {
        ...(entry._typeData ?? {}),
        [currentSlug]: { client: entry.client, description: entry.description, customFields: entry.customFields ?? {} },
      },
    });
  };

  const hours = calcHours(entry.startTime, entry.endTime);
  const activeSlug = entry.entryType ?? "standard";
  const customType = entryTypes.find((t) => t.slug === activeSlug);
  const isCustom = activeSlug !== "standard" && !!customType;
  const hasCustomTypes = entryTypes.length > 0;
  const effectiveTimeMode = customType?.time_mode ?? (customType?.is_timed !== false ? "job" : "none");
  const showTime = !isCustom || effectiveTimeMode === "job";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Job</span>
        <div className="flex items-center gap-2">
          {hours !== "—" && (
            <span className="text-sm font-semibold text-gray-700 bg-blue-50 px-2 py-0.5 rounded-full">
              {hours}
            </span>
          )}
          {onLinkJob && (
            <button
              type="button"
              onClick={onLinkJob}
              className="text-xs text-blue-500 border border-blue-200 rounded-lg px-2 py-0.5 hover:bg-blue-50 transition-colors"
            >
              📅 Link to schedule
            </button>
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

      {entry.linkedEventId && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-green-700 font-medium flex-1 min-w-0 truncate">
            📅 {entry.linkedEventTitle ?? "Linked event"}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...entry, linkedEventId: undefined, linkedEventTitle: undefined })}
            className="text-green-400 hover:text-green-600 text-base leading-none font-bold shrink-0"
            aria-label="Unlink event"
          >
            ×
          </button>
        </div>
      )}

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
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-gray-500 mb-1">Start time</label>
            <input
              type="time"
              value={entry.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1 min-w-0">
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
                className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-red-500 leading-none shadow-sm"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-colors disabled:opacity-50"
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
