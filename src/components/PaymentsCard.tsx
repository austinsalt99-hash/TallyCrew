"use client";

import { useEffect, useState } from "react";
import { PAYMENT_METHODS, formatInvoiceDate, formatMoney } from "@/app/admin/invoices/_components/invoiceFormat";
import PaidProgress from "@/components/PaidProgress";

interface Payment {
  id: string;
  quote_id: string | null;
  invoice_id: string | null;
  amount: number;
  paid_on: string;
  method: string;
  note: string | null;
}

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? "Other";

// Money received by hand against a quote (deposit) or an invoice. Nothing is
// charged here — the admin just records what came in.
export default function PaymentsCard({
  kind, docId, total, refreshKey = 0, onChange,
}: {
  kind: "invoice" | "quote";
  docId: string;
  total: number;
  refreshKey?: number;
  onChange?: (amountPaid: number) => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayStr());
  const [method, setMethod] = useState("etransfer");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const param = kind === "invoice" ? "invoiceId" : "quoteId";

  useEffect(() => {
    fetch(`/api/payments?${param}=${docId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setPayments(Array.isArray(data) ? data : []); setLoaded(true); });
  }, [param, docId, refreshKey]);

  const paid = Math.round(payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);

  function openForm() {
    setAmount(balance > 0 ? balance.toFixed(2) : "");
    setPaidOn(todayStr());
    setMethod("etransfer");
    setNote("");
    setError("");
    setAdding(true);
  }

  async function reload() {
    const res = await fetch(`/api/payments?${param}=${docId}`, { credentials: "include" });
    const data = await res.json();
    const list: Payment[] = Array.isArray(data) ? data : [];
    setPayments(list);
    onChange?.(Math.round(list.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        [kind === "invoice" ? "invoice_id" : "quote_id"]: docId,
        amount, paid_on: paidOn, method, note,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Couldn't save the payment."); return; }
    setAdding(false);
    await reload();
  }

  async function remove(id: string) {
    await fetch("/api/payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setConfirmDeleteId(null);
    await reload();
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Payments</h2>
        {!adding && (
          <button onClick={openForm} className="text-sm font-semibold text-navy-600 hover:text-navy-800">+ Record payment</button>
        )}
      </div>

      <PaidProgress paid={paid} total={total} />

      {loaded && payments.length === 0 && !adding && (
        <p className="text-sm text-gray-400 mt-3">
          {kind === "quote"
            ? "No deposit recorded yet. Deposits carry over when this quote becomes an invoice."
            : "No payments recorded yet."}
        </p>
      )}

      {payments.length > 0 && (
        <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
          {payments.map((p) => (
            <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">{formatMoney(Number(p.amount))}</span>
                  <span className="text-gray-400"> · {methodLabel(p.method)} · {formatInvoiceDate(p.paid_on)}</span>
                </p>
                {(p.note || (kind === "invoice" && p.quote_id)) && (
                  <p className="text-xs text-gray-400 truncate">
                    {kind === "invoice" && p.quote_id ? "Deposit from quote" : ""}
                    {kind === "invoice" && p.quote_id && p.note ? " · " : ""}
                    {p.note}
                  </p>
                )}
              </div>
              {confirmDeleteId === p.id ? (
                <span className="flex items-center gap-2 text-xs font-semibold shrink-0">
                  <button onClick={() => remove(p.id)} className="text-red-600 hover:text-red-700">Remove</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 font-normal">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDeleteId(p.id)} className="text-xs text-gray-400 hover:text-red-500 shrink-0">Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date paid</label>
              <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={`block min-w-0 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">How they paid</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputCls} bg-white`}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cheque #1042" className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white rounded-xl py-2 text-sm font-semibold">
              {saving ? "Saving…" : "Save payment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
