"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface LineItem {
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: string;
}

interface BillableEntry {
  client: string;
  description: string;
  startTime: string;
  endTime: string;
  entryType?: string;
}

interface Submission {
  id: string;
  employee_name: string;
  date: string;
  billable_entries: BillableEntry[];
  total_billable_hours: number;
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nextInvoiceNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map((n) => {
      const m = n.match(/^INV-\d{4}-(\d+)$/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${year}-${String(next).padStart(3, "0")}`;
}

export default function NewInvoicePage() {
  const router = useRouter();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [clientName, setClientName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayStr());
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data: { invoice_number: string }[]) => {
        const nums = Array.isArray(data) ? data.map((d) => d.invoice_number) : [];
        setInvoiceNumber(nextInvoiceNumber(nums));
      });
  }, []);

  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  function loadEntries() {
    if (!clientName.trim()) { setLoadError("Enter a client name first."); return; }
    if (!dateFrom) { setLoadError("Enter a start date."); return; }
    setLoadError("");

    fetch("/api/submissions", { credentials: "include" })
      .then((r) => r.json())
      .then((data: Submission[]) => {
        if (!Array.isArray(data)) return;
        const items: LineItem[] = [];
        data.forEach((sub) => {
          if (sub.date < dateFrom || sub.date > dateTo) return;
          (sub.billable_entries ?? []).forEach((entry) => {
            if (entry.client?.toLowerCase() !== clientName.trim().toLowerCase()) return;
            items.push({
              description: entry.description || entry.entryType || "",
              employee: sub.employee_name,
              date: sub.date,
              hours: calcHours(entry.startTime, entry.endTime),
              amount: "",
            });
          });
        });
        if (items.length === 0) {
          setLoadError("No billable entries found for that client and date range.");
        } else {
          setLineItems(items);
        }
      });
  }

  function updateItem(i: number, field: keyof LineItem, value: string) {
    setLineItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function removeItem(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addBlankItem() {
    setLineItems((prev) => [...prev, { description: "", employee: "", date: todayStr(), hours: "", amount: "" }]);
  }

  async function save() {
    if (!clientName.trim()) { setLoadError("Client name is required."); return; }
    if (!dateFrom || !dateTo) { setLoadError("Date range is required."); return; }
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        invoice_number: invoiceNumber,
        client_name: clientName,
        date_from: dateFrom,
        date_to: dateTo,
        invoice_date: invoiceDate,
        company_name: companyName || null,
        company_address: companyAddress || null,
        line_items: lineItems,
        total,
        notes: notes || null,
        status: "draft",
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.id) {
      router.push(`/admin/invoices/${data.id}`);
    } else {
      setLoadError(data.error ?? "Failed to save invoice.");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
      </div>

      {/* Invoice details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
        <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Invoice Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Invoice #</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Your Company Name</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Cumberland Earthworks"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Your Company Address</label>
            <input
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="e.g. 123 Main St, City, TN"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Payment terms, thank you message, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>
      </div>

      {/* Load entries from submissions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Load Entries from Hour Logs</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Client Name</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Must match exactly as entered"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={loadEntries}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-2 text-sm"
          >
            Load Entries
          </button>
        </div>
        {loadError && <p className="text-red-500 text-sm mt-2">{loadError}</p>}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Line Items</h2>
        {lineItems.length === 0 ? (
          <p className="text-sm text-gray-400 mb-3">No items yet. Load entries above or add a blank line.</p>
        ) : (
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Employee</th>
                <th className="pb-2 pr-3">Description</th>
                <th className="pb-2 pr-3 text-right">Hours</th>
                <th className="pb-2 pr-3 text-right">Amount ($)</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3">
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateItem(i, "date", e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      value={item.employee}
                      onChange={(e) => updateItem(i, "employee", e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-500 text-xs whitespace-nowrap">
                    {item.hours !== "" ? `${item.hours}h` : "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => updateItem(i, "amount", e.target.value)}
                      placeholder="0.00"
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-24 text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="py-1.5">
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={addBlankItem}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add blank line
        </button>
      </div>

      {/* Total + save */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div className="text-lg font-bold text-gray-900">
          Total: <span className="text-blue-600">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-2 text-sm"
        >
          {saving ? "Saving…" : "Save as Draft"}
        </button>
      </div>
    </div>
  );
}
