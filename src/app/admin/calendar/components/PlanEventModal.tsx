"use client";

import { useState, useEffect } from "react";
import { EVENT_TYPES, EventType, PlanEvent } from "../constants/eventTypes";

const EMPTY_FORM = {
  title: "",
  event_type: "task" as EventType,
  date: "",
  start_time: "",
  end_time: "",
  description: "",
  location: "",
  attendees: "",
  is_done: false,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (saved: PlanEvent) => void;
  initialType?: EventType;
  initialDate?: string;
  editEvent?: PlanEvent | null;
}

export default function PlanEventModal({ open, onClose, onSave, initialType, initialDate, editEvent }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    if (editEvent) {
      setForm({
        title: editEvent.title,
        event_type: editEvent.event_type,
        date: editEvent.date,
        start_time: editEvent.start_time ?? "",
        end_time: editEvent.end_time ?? "",
        description: editEvent.description ?? "",
        location: editEvent.location ?? "",
        attendees: editEvent.attendees ?? "",
        is_done: editEvent.is_done,
      });
    } else {
      setForm({ ...EMPTY_FORM, event_type: initialType ?? "task", date: initialDate ?? "" });
    }
  }, [open, editEvent, initialType, initialDate]);

  if (!open) return null;

  async function handleSave() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const method = editEvent ? "PUT" : "POST";
      const body = editEvent ? { id: editEvent.id, ...form } : form;
      const res = await fetch("/api/admin/plan-events", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setSaving(false);
        return;
      }
      const saved = await res.json();
      onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  const typeConfig = EVENT_TYPES[form.event_type];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: typeConfig.color }} />
          <h2 className="text-lg font-bold text-gray-900">{editEvent ? "Edit" : "Add"} {typeConfig.label}</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, event_type: t })}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors"
                  style={
                    form.event_type === t
                      ? { backgroundColor: EVENT_TYPES[t].bg, borderColor: EVENT_TYPES[t].color, color: EVENT_TYPES[t].color }
                      : { backgroundColor: "white", borderColor: "#e5e7eb", color: "#6b7280" }
                  }
                >
                  {EVENT_TYPES[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              placeholder={`${typeConfig.label} title`}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.date}
            className="flex-1 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: typeConfig.color }}
          >
            {saving ? "Saving…" : editEvent ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
