"use client";

import { useEffect, useState } from "react";
import { formatInvoiceDate, formatMoney } from "@/app/admin/invoices/_components/invoiceFormat";
import { EXPENSE_CATEGORIES, categoryLabel, type ExpenseCategory, type ExpenseItem } from "@/types/expense";

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildQuery(opts: { jobId?: string; quoteId?: string; invoiceId?: string; jobIds?: string[] }): string {
  const params = new URLSearchParams();
  if (opts.jobId) params.set("jobId", opts.jobId);
  if (opts.quoteId) params.set("quoteId", opts.quoteId);
  if (opts.invoiceId) params.set("invoiceId", opts.invoiceId);
  if (opts.jobIds?.length) params.set("jobIds", opts.jobIds.join(","));
  return params.toString();
}

const GENERAL_LABEL = "General (not tied to a job)";

// Materials, equipment, subcontractors and other job costs — money going
// out, shown next to Payments (money coming in). Used on a job's calendar
// panel, a quote's and an invoice's detail pages (see supabase-schema.sql
// section 28). All added expenses roll into the Financials page.
export default function ExpensesCard({
  jobId, quoteId, invoiceId, jobIds, isPrivate, readOnly, onChange,
}: {
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  // Extra jobs whose expenses should be included too — an invoice rolls up
  // the expenses of every job it's linked to, not just its own. When more
  // than one job is in play (or there are some not tied to any job), the
  // list breaks down into one section per job instead of a flat list.
  jobIds?: string[];
  // Quotes: expenses are for the boss's own records, never shown to the client.
  isPrivate?: boolean;
  // View-only: no add/remove — used to preview a job's already-logged costs
  // before there's an id to attach new ones to (e.g. a brand-new invoice).
  readOnly?: boolean;
  onChange?: (total: number) => void;
}) {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [incurredOn, setIncurredOn] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = buildQuery({ jobId, quoteId, invoiceId, jobIds });

  useEffect(() => {
    fetch(`/api/expenses?${query}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list: ExpenseItem[] = Array.isArray(data) ? data : [];
        setItems(list);
        setLoaded(true);
        onChange?.(Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function reload() {
    const res = await fetch(`/api/expenses?${query}`, { credentials: "include" });
    const data = await res.json();
    const list: ExpenseItem[] = Array.isArray(data) ? data : [];
    setItems(list);
    setLoaded(true);
    onChange?.(Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100);
  }

  const total = Math.round(items.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  // One group per job (plus a "General" group for anything not tied to a
  // job) — only shown as a breakdown when there's more than one, so a
  // single-job view (the common case) stays a plain flat list.
  const groupsMap = new Map<string, { label: string; items: ExpenseItem[] }>();
  for (const item of items) {
    const key = item.jobId ?? "__none__";
    const label = item.jobId ? (item.jobTitle ?? "Job") : GENERAL_LABEL;
    if (!groupsMap.has(key)) groupsMap.set(key, { label, items: [] });
    groupsMap.get(key)!.items.push(item);
  }
  const groups = [...groupsMap.entries()].map(([key, g]) => ({
    key, label: g.label, items: g.items,
    total: Math.round(g.items.reduce((s, e) => s + e.amount, 0) * 100) / 100,
  })).sort((a, b) => (a.key === "__none__" ? 1 : b.key === "__none__" ? -1 : a.label.localeCompare(b.label)));
  const showGroups = groups.length > 1;

  function openForm() {
    setAmount("");
    setCategory("materials");
    setIncurredOn(todayStr());
    setNote("");
    setError("");
    setAdding(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        job_id: jobId, quote_id: quoteId, invoice_id: invoiceId,
        amount, category, incurred_on: incurredOn, note,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Couldn't save the expense."); return; }
    setAdding(false);
    await reload();
  }

  async function remove(item: ExpenseItem) {
    await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: item.id, source: item.source, submissionId: item.submissionId }),
    });
    setConfirmDeleteId(null);
    await reload();
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";

  function renderRow(e: ExpenseItem) {
    return (
      <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-900">
            <span className="font-semibold text-red-600">-{formatMoney(e.amount)}</span>
            <span className="text-gray-400"> · {categoryLabel(e.category)} · {formatInvoiceDate(e.date)}</span>
          </p>
          {(e.note || e.source === "timesheet") && (
            <p className="text-xs text-gray-400 truncate">
              {e.source === "timesheet" ? `Logged on timesheet · ${e.employeeName ?? ""}` : ""}
              {e.source === "timesheet" && e.note ? " · " : ""}
              {e.note}
            </p>
          )}
        </div>
        {e.removable && !readOnly ? (
          confirmDeleteId === e.id ? (
            <span className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <button onClick={() => remove(e)} className="text-red-600 hover:text-red-700">Remove</button>
              <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 font-normal">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDeleteId(e.id)} className="text-xs text-gray-400 hover:text-red-500 shrink-0">Remove</button>
          )
        ) : e.source === "timesheet" ? (
          <span className="text-[10px] text-gray-300 shrink-0 uppercase tracking-wide">Timesheet</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Expenses</h2>
        {!adding && !readOnly && (
          <button onClick={openForm} className="text-sm font-semibold text-navy-600 hover:text-navy-800">+ Add expense</button>
        )}
      </div>
      {isPrivate && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
          Private — not shown to the client. Counts toward your Financials.
        </p>
      )}

      {loaded && items.length === 0 && !adding && (
        <p className="text-sm text-gray-400 mt-2">No expenses recorded yet.</p>
      )}

      {items.length > 0 && (
        <div className="mt-3 border-t border-gray-100">
          {showGroups ? (
            <div className="divide-y divide-gray-100">
              {groups.map((g) => (
                <div key={g.key} className="py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-500 truncate">{g.label}</p>
                    <p className="text-xs font-semibold text-red-500 shrink-0 ml-2">-{formatMoney(g.total)}</p>
                  </div>
                  <div className="divide-y divide-gray-50">{g.items.map(renderRow)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">{items.map(renderRow)}</div>
          )}
          <div className="py-2.5 flex items-center justify-between gap-3 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Total</p>
            <p className="text-sm font-bold text-red-600">-{formatMoney(total)}</p>
          </div>
        </div>
      )}

      {adding && !readOnly && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className={`block min-w-0 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={`${inputCls} bg-white`}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Home Depot receipt" className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white rounded-xl py-2 text-sm font-semibold">
              {saving ? "Saving…" : "Save expense"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
