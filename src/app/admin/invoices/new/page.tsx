"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItemState {
  id: string;
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: string;
  sourceJobId?: string;
  sourceJobTitle?: string;
}

interface LinkedJob {
  eventId: string;
  title: string;
  client: string;
  date: string;
}

interface JobResult {
  id: string;
  title: string;
  client: string;
  date: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nextInvoiceNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map((n) => { const m = n.match(/^INV-\d{4}-(\d+)$/); return m ? parseInt(m[1]) : 0; })
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${year}-${String(next).padStart(3, "0")}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function blankItem(): LineItemState {
  return { id: crypto.randomUUID(), description: "", employee: "", date: todayStr(), hours: "", amount: "" };
}

// ── Editable cell (used in right preview panel) ───────────────────────────────

function EditableCell({
  value,
  type = "text",
  onCommit,
  onFocus,
  className = "",
  placeholder = "—",
}: {
  value: string | number;
  type?: "text" | "number";
  onCommit: (val: string) => void;
  onFocus: () => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));

  // Keep local in sync when value changes externally (e.g. left panel edit)
  useEffect(() => { if (!editing) setLocal(String(value)); }, [value, editing]);

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={local}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(local); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onCommit(local); } }}
        className={`bg-transparent border-b border-navy-400 outline-none ${className}`}
        style={{ width: "100%", minWidth: 40 }}
      />
    );
  }

  return (
    <span
      onClick={() => { setEditing(true); onFocus(); }}
      title="Click to edit"
      className={`cursor-text rounded px-0.5 hover:bg-navy-50 transition-colors ${className}`}
    >
      {String(value) !== "" ? String(value) : <span className="text-gray-300">{placeholder}</span>}
    </span>
  );
}

// ── Invoice preview (right panel) ─────────────────────────────────────────────

function InvoicePreview({
  invoiceNumber,
  invoiceDate,
  companyName,
  companyAddress,
  clientName,
  dateFrom,
  dateTo,
  notes,
  lineItems,
  activeItemId,
  onActivate,
  onUpdateItem,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  companyName: string;
  companyAddress: string;
  clientName: string;
  dateFrom: string;
  dateTo: string;
  notes: string;
  lineItems: LineItemState[];
  activeItemId: string | null;
  onActivate: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItemState, value: string) => void;
}) {
  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[600px]">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {companyName && <div className="text-xl font-bold text-gray-900 mb-1">{companyName}</div>}
          {companyAddress && <div className="text-sm text-gray-500 whitespace-pre-line">{companyAddress}</div>}
          {!companyName && !companyAddress && (
            <div className="text-sm text-gray-300 italic">Your company name &amp; address</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-navy-600 mb-1">INVOICE</div>
          <div className="text-sm text-gray-600 space-y-0.5">
            <div><span className="font-medium">Invoice #:</span> {invoiceNumber || "—"}</div>
            <div><span className="font-medium">Date:</span> {invoiceDate ? formatDate(invoiceDate) : "—"}</div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bill To</div>
        <div className="text-lg font-semibold text-gray-900">{clientName || <span className="text-gray-300">Client name</span>}</div>
        {(dateFrom || dateTo) && (
          <div className="text-sm text-gray-500">
            Work performed: {dateFrom ? formatDate(dateFrom) : "—"} – {dateTo ? formatDate(dateTo) : "—"}
          </div>
        )}
      </div>

      {/* Line items table */}
      <table className="w-full text-sm mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="text-left py-2 pr-3 w-24">Date</th>
            <th className="text-left py-2 pr-3 w-28">Employee</th>
            <th className="text-left py-2 pr-3">Description</th>
            <th className="text-right py-2 pr-3 w-14">Hours</th>
            <th className="text-right py-2 w-20">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-gray-300 text-sm italic">
                Line items will appear here
              </td>
            </tr>
          ) : lineItems.map((item) => {
            const isActive = activeItemId === item.id;
            return (
              <tr
                key={item.id}
                className={`border-b border-gray-100 transition-colors ${isActive ? "bg-navy-50" : ""}`}
              >
                <td className="py-2 pr-3 text-gray-600 text-xs">{item.date || "—"}</td>
                <td className="py-2 pr-3 text-gray-700 text-xs">{item.employee || "—"}</td>
                <td className="py-2 pr-3 text-gray-700">
                  <EditableCell
                    value={item.description}
                    onFocus={() => onActivate(item.id)}
                    onCommit={(v) => onUpdateItem(item.id, "description", v)}
                    placeholder="Description"
                    className="text-sm"
                  />
                </td>
                <td className="py-2 pr-3 text-right text-gray-500">
                  <EditableCell
                    value={item.hours !== "" && item.hours !== 0 ? item.hours : ""}
                    type="number"
                    onFocus={() => onActivate(item.id)}
                    onCommit={(v) => onUpdateItem(item.id, "hours", v)}
                    placeholder="0"
                    className="text-sm text-right"
                  />
                </td>
                <td className="py-2 text-right font-medium text-gray-900">
                  <EditableCell
                    value={item.amount}
                    type="number"
                    onFocus={() => onActivate(item.id)}
                    onCommit={(v) => onUpdateItem(item.id, "amount", v)}
                    placeholder="0.00"
                    className="text-sm text-right"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="text-right py-3 pr-3 font-bold text-gray-700 text-base">Total</td>
            <td className="py-3 text-right font-bold text-navy-600 text-base">${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {notes && (
        <div className="border-t border-gray-100 pt-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-sm text-gray-600 whitespace-pre-line">{notes}</p>
        </div>
      )}

      {/* Draft watermark */}
      <div className="mt-6 text-center text-xs text-gray-300 uppercase tracking-widest">— Draft —</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const router = useRouter();

  // Invoice meta
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");

  // Line items & linked jobs
  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);

  // Job search
  const [jobSearch, setJobSearch] = useState("");
  const [jobResults, setJobResults] = useState<JobResult[]>([]);
  const [jobSearchOpen, setJobSearchOpen] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Left–right sync
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Mobile view toggle
  const [mobileView, setMobileView] = useState<"form" | "preview">("form");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── On mount: fetch invoice number ────────────────────────────────────────
  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data: { invoice_number: string }[]) => {
        const nums = Array.isArray(data) ? data.map((d) => d.invoice_number) : [];
        setInvoiceNumber(nextInvoiceNumber(nums));
      });
  }, []);

  // ── Job search ────────────────────────────────────────────────────────────
  const searchJobs = useCallback(async (term: string) => {
    if (!term.trim()) { setJobResults([]); setJobSearchOpen(false); return; }
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("job_events")
      .select("id, title, client, date")
      .or(`title.ilike.%${term}%,client.ilike.%${term}%`)
      .order("date", { ascending: false })
      .limit(8);
    setJobResults(data ?? []);
    setJobSearchOpen(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchJobs(jobSearch), 300);
    return () => clearTimeout(t);
  }, [jobSearch, searchJobs]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setJobSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Link a job ────────────────────────────────────────────────────────────
  async function linkJob(job: JobResult) {
    if (linkedJobs.some((j) => j.eventId === job.id)) {
      setJobSearch(""); setJobSearchOpen(false); return;
    }
    setLoadingJobId(job.id);
    setJobSearch(""); setJobSearchOpen(false);

    const res = await fetch(`/api/invoices/job-entries?eventId=${job.id}`, { credentials: "include" });
    const data = await res.json();
    setLoadingJobId(null);

    if (!res.ok) return;

    const { event, lineItems: newItems } = data as { event: LinkedJob & { id: string }; lineItems: LineItemState[] };

    setLinkedJobs((prev) => [...prev, { eventId: job.id, title: event.title, client: event.client, date: event.date }]);
    setLineItems((prev) => [...prev, ...newItems]);

    // Auto-fill client name if not set
    if (!clientName && event.client) setClientName(event.client);

    // Auto-fill / expand date range
    setDateFrom((prev) => {
      if (!prev || event.date < prev) return event.date;
      return prev;
    });
    setDateTo((prev) => {
      if (!prev || event.date > prev) return event.date;
      return prev;
    });
  }

  // ── Unlink a job ──────────────────────────────────────────────────────────
  function unlinkJob(eventId: string) {
    setLinkedJobs((prev) => prev.filter((j) => j.eventId !== eventId));
    setLineItems((prev) => prev.filter((item) => item.sourceJobId !== eventId));

    // Recompute date range from remaining jobs
    setLinkedJobs((prev) => {
      const remaining = prev.filter((j) => j.eventId !== eventId);
      if (remaining.length > 0) {
        const dates = remaining.map((j) => j.date).sort();
        setDateFrom(dates[0]);
        setDateTo(dates[dates.length - 1]);
      }
      return remaining;
    });
  }

  // ── Line item CRUD ────────────────────────────────────────────────────────
  function updateItem(id: string, field: keyof LineItemState, value: string) {
    setLineItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
    if (activeItemId === id) setActiveItemId(null);
  }

  function addBlankItem() {
    const item = blankItem();
    setLineItems((prev) => [...prev, item]);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (!invoiceNumber.trim()) { setSaveError("Invoice number is required."); return; }
    if (!clientName.trim()) { setSaveError("Client name is required."); return; }
    setSaveError("");
    setSaving(true);

    const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const savedItems = lineItems.map(({ id: _id, sourceJobId: _sj, sourceJobTitle: _st, ...rest }) => rest);

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        invoice_number: invoiceNumber,
        client_name: clientName,
        date_from: dateFrom || todayStr(),
        date_to: dateTo || todayStr(),
        invoice_date: invoiceDate,
        company_name: companyName || null,
        company_address: companyAddress || null,
        line_items: savedItems,
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
      setSaveError(data.error ?? "Failed to save. Please try again.");
    }
  }

  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="-mx-4 -mt-8">
      {/* Mobile toggle bar */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white sticky top-0 z-20">
        {(["form", "preview"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setMobileView(v)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              mobileView === v ? "text-navy-600 border-b-2 border-navy-600" : "text-gray-400"
            }`}
          >
            {v === "form" ? "Form" : "Preview"}
          </button>
        ))}
      </div>

      {/* Split grid */}
      <div className="grid lg:grid-cols-[45%_55%]">
        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className={`${mobileView === "preview" ? "hidden lg:block" : "block"} px-4 pt-8 space-y-4 bg-gray-50 lg:bg-transparent`} style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Invoice Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice #</label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Your Company Name</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Your Company Address</label>
                <input
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client Name</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Auto-fills from linked job"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-1">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Work From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Work To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment terms, thank you message, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
              />
            </div>
          </div>

          {/* Link a Job */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-3">Link a Job</h2>
            <p className="text-xs text-gray-400 mb-3">
              Search your calendar jobs — linked hour logs are automatically added as line items.
            </p>

            {/* Linked job chips */}
            {linkedJobs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {linkedJobs.map((job) => {
                  const count = lineItems.filter((i) => i.sourceJobId === job.eventId).length;
                  return (
                    <div key={job.eventId} className="flex items-center gap-1.5 bg-navy-50 border border-navy-200 rounded-full px-3 py-1 text-xs">
                      <span className="font-semibold text-navy-700">{job.title}</span>
                      <span className="text-navy-400">·</span>
                      <span className="text-navy-500">{count} {count === 1 ? "item" : "items"}</span>
                      <button
                        onClick={() => unlinkJob(job.eventId)}
                        className="ml-1 text-navy-400 hover:text-navy-700 transition-colors"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search input */}
            <div ref={searchRef} className="relative">
              <input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search by job title or client…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                onFocus={() => { if (jobResults.length > 0) setJobSearchOpen(true); }}
              />
              {jobSearchOpen && jobResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                  {jobResults.map((job) => {
                    const alreadyLinked = linkedJobs.some((j) => j.eventId === job.id);
                    return (
                      <button
                        key={job.id}
                        disabled={alreadyLinked || loadingJobId === job.id}
                        onClick={() => linkJob(job)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                          <p className="text-xs text-gray-500">{job.client} · {job.date}</p>
                        </div>
                        {alreadyLinked ? (
                          <span className="text-xs text-navy-500 font-medium">Linked</span>
                        ) : loadingJobId === job.id ? (
                          <span className="text-xs text-gray-400">Loading…</span>
                        ) : (
                          <span className="text-xs text-navy-600 font-semibold">+ Add</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {jobSearch.trim() && jobSearchOpen && jobResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 px-4 py-3">
                  <p className="text-sm text-gray-400">No jobs found for "{jobSearch}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-3">Line Items</h2>
            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-400 mb-3">Link a job above or add a line manually.</p>
            ) : (
              <div className="space-y-1 mb-3">
                {lineItems.map((item) => {
                  const isActive = activeItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[1fr_auto] gap-2 rounded-lg p-2 transition-colors ${isActive ? "bg-navy-50 ring-2 ring-navy-300 ring-inset" : "hover:bg-gray-50"}`}
                    >
                      <div className="space-y-1.5">
                        {item.sourceJobTitle && (
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                            {item.sourceJobTitle}
                          </span>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[10px] text-gray-400">Employee</label>
                            <input
                              value={item.employee}
                              onChange={(e) => updateItem(item.id, "employee", e.target.value)}
                              onFocus={() => setActiveItemId(item.id)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">Date</label>
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(item.id, "date", e.target.value)}
                              onFocus={() => setActiveItemId(item.id)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">Description</label>
                          <input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, "description", e.target.value)}
                            onFocus={() => setActiveItemId(item.id)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[10px] text-gray-400">Hours</label>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={item.hours}
                              onChange={(e) => updateItem(item.id, "hours", e.target.value)}
                              onFocus={() => setActiveItemId(item.id)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">Amount ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                              onFocus={() => setActiveItemId(item.id)}
                              placeholder="0.00"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="self-start mt-1 text-red-400 hover:text-red-600 p-1"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={addBlankItem} className="text-sm text-navy-600 hover:text-navy-800 font-medium">
              + Add line manually
            </button>
          </div>

          {/* Total + Save */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div className="text-lg font-bold text-gray-900">
              Total: <span className="text-navy-600">${total.toFixed(2)}</span>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="bg-navy-600 hover:bg-navy-700 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-2.5 text-sm"
            >
              {saving ? "Saving…" : "Save as Draft"}
            </button>
          </div>
          {saveError && <p className="text-red-500 text-sm text-center">{saveError}</p>}
        </div>

        {/* ── RIGHT PANEL (preview) ───────────────────────────────────────── */}
        <div
          className={`${mobileView === "form" ? "hidden lg:block" : "block"} border-l border-gray-200 bg-gray-50 px-4 py-8`}
          style={{ position: "sticky", top: 72, alignSelf: "start", maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}
        >
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Live Preview
            <span className="normal-case font-normal ml-2 text-gray-300">· click any field to edit</span>
          </p>
          <InvoicePreview
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
            companyName={companyName}
            companyAddress={companyAddress}
            clientName={clientName}
            dateFrom={dateFrom}
            dateTo={dateTo}
            notes={notes}
            lineItems={lineItems}
            activeItemId={activeItemId}
            onActivate={setActiveItemId}
            onUpdateItem={updateItem}
          />
        </div>
      </div>
    </div>
  );
}
