"use client";

import { useEffect, useState } from "react";

export interface ChecklistItem {
  id: string;
  job_id: string;
  text: string;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  position: number;
}

export default function JobChecklist({ jobId, canManage }: { jobId: string; canManage: boolean }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/job-checklist?jobId=${jobId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [jobId]);

  async function toggle(item: ChecklistItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)));
    const res = await fetch("/api/job-checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: item.id, is_done: !item.is_done }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
  }

  async function addItem() {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    const res = await fetch("/api/job-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ job_id: jobId, text, position: items.length }),
    });
    if (res.ok) {
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setNewText("");
    }
    setAdding(false);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/job-checklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
  }

  if (loading) return <p className="text-xs text-gray-400">Loading checklist…</p>;

  return (
    <div className="space-y-2">
      {items.length === 0 && !canManage && (
        <p className="text-xs text-gray-400">No checklist items for this job.</p>
      )}
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-2 group">
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={() => toggle(item)}
            className="w-4 h-4 mt-0.5 rounded accent-navy-600 flex-shrink-0"
          />
          <span className={`text-sm flex-1 ${item.is_done ? "line-through text-gray-400" : "text-gray-800"}`}>
            {item.text}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Remove item"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
            </button>
          )}
        </div>
      ))}
      {canManage && (
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            placeholder="Add checklist item…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={adding || !newText.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-navy-600 hover:bg-navy-700 disabled:bg-navy-300 text-white rounded-lg"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
