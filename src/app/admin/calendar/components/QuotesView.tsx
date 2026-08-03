"use client";

import { useState } from "react";

export interface Quote {
  id: string;
  title: string;
  client: string | null;
  location: string | null;
  description: string | null;
  estimated_price: number | null;
  target_date: string | null;
  valid_until: string | null;
  status: "pending" | "accepted" | "declined" | "converted";
  converted_job_id: string | null;
  created_at: string;
}

const EMPTY_QUOTE_FORM = {
  title: "",
  client: "",
  location: "",
  description: "",
  estimated_price: "",
  target_date: "",
  valid_until: "",
  status: "pending" as "pending" | "accepted" | "declined",
};

const STATUS_BADGE: Record<Quote["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-600",
  converted: "bg-navy-100 text-navy-700",
};

type QuoteFilter = "open" | "pending" | "accepted" | "declined" | "converted";

const FILTER_TABS: { label: string; value: QuoteFilter }[] = [
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Declined", value: "declined" },
  { label: "Converted", value: "converted" },
];

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function QuotesView({
  quotes,
  onRefresh,
  onConvertToJob,
}: {
  quotes: Quote[];
  onRefresh: () => void;
  onConvertToJob: (quote: Quote) => void;
}) {
  const [filter, setFilter] = useState<QuoteFilter>("open");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_QUOTE_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visible = quotes.filter((q) => filter === "open" ? q.status !== "converted" : q.status === filter);

  function openNew() {
    setForm(EMPTY_QUOTE_FORM);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(q: Quote) {
    setForm({
      title: q.title,
      client: q.client ?? "",
      location: q.location ?? "",
      description: q.description ?? "",
      estimated_price: q.estimated_price != null ? String(q.estimated_price) : "",
      target_date: q.target_date ?? "",
      valid_until: q.valid_until ?? "",
      status: q.status === "converted" ? "pending" : q.status,
    });
    setEditingId(q.id);
    setShowModal(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      client: form.client || null,
      location: form.location || null,
      description: form.description || null,
      estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : null,
      target_date: form.target_date || null,
      valid_until: form.valid_until || null,
      status: form.status,
    };
    await fetch("/api/quotes", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    });
    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function deleteQuote(id: string) {
    await fetch("/api/quotes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setConfirmDeleteId(null);
    onRefresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Quotes</h2>
        <button
          onClick={openNew}
          className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm"
        >
          + New Quote
        </button>
      </div>

      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-full overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const count = quotes.filter((q) => tab.value === "open" ? q.status !== "converted" : q.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={filter === tab.value ? { backgroundColor: "#0A1172" } : undefined}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                filter === tab.value ? "text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={filter === tab.value ? { backgroundColor: "rgba(255,255,255,0.2)" } : undefined}
                  className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${
                    filter === tab.value ? "text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          {filter === "open" ? (
            <>No open quotes. <button onClick={openNew} className="text-navy-600 underline">Create one.</button></>
          ) : (
            `No ${filter} quotes.`
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visible.map((q) => (
            <div key={q.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-semibold text-gray-900 text-sm truncate">{q.title}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[q.status]}`}>
                  {q.status}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {q.client || "No client"}
                  {q.target_date ? ` · ${fmtDate(q.target_date)}` : ""}
                </span>
                <span className="text-sm font-semibold text-gray-900">{fmtMoney(q.estimated_price)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                {q.status !== "converted" && (
                  <button onClick={() => onConvertToJob(q)} className="text-navy-600 hover:text-navy-800">
                    Convert to Job →
                  </button>
                )}
                <button onClick={() => openEdit(q)} className="text-gray-500 hover:text-gray-700">Edit</button>
                {confirmDeleteId === q.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400 font-normal">Delete?</span>
                    <button onClick={() => deleteQuote(q.id)} className="text-red-600 hover:text-red-700">Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 font-normal">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDeleteId(q.id)} className="text-red-400 hover:text-red-600">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit Quote" : "New Quote"}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client</label>
                <input type="text" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target date <span className="font-normal text-gray-400">(tentative)</span></label>
                <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valid until</label>
                <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estimated price ($)</label>
                <input type="number" min="0" step="0.01" value={form.estimated_price}
                  onChange={(e) => setForm({ ...form, estimated_price: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white">
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.title.trim()}
                className="flex-1 bg-navy-600 hover:bg-navy-700 disabled:bg-navy-400 text-white rounded-xl py-2.5 text-sm font-bold"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
