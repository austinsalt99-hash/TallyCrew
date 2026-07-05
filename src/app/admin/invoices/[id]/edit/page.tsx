"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  client: string;
  date: string;
}

interface BreakdownEntry {
  employee: string;
  date: string;
  hours: number;
}

interface LineItemState {
  id: string;
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: string;
  sourceJobId?: string;
  sourceJobTitle?: string;
  breakdown?: BreakdownEntry[];
  priceBasis?: string[];
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

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function blankItem(): LineItemState {
  return { id: crypto.randomUUID(), description: "", employee: "", date: todayStr(), hours: "", amount: "" };
}

// ── Editable cell ─────────────────────────────────────────────────────────────

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

// ── Invoice preview ───────────────────────────────────────────────────────────

function InvoicePreview({
  invoiceNumber, invoiceDate, companyName, companyAddress,
  clientName, dateFrom, dateTo, notes, lineItems, activeItemId, onActivate, onUpdateItem,
}: {
  invoiceNumber: string; invoiceDate: string; companyName: string; companyAddress: string;
  clientName: string; dateFrom: string; dateTo: string; notes: string;
  lineItems: LineItemState[]; activeItemId: string | null;
  onActivate: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItemState, value: string) => void;
}) {
  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[600px]">
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

      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bill To</div>
        <div className="text-lg font-semibold text-gray-900">{clientName || <span className="text-gray-300">Client name</span>}</div>
        {(dateFrom || dateTo) && (
          <div className="text-sm text-gray-500">
            Work performed: {dateFrom ? formatDate(dateFrom) : "—"} – {dateTo ? formatDate(dateTo) : "—"}
          </div>
        )}
      </div>

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
              <td colSpan={5} className="py-6 text-center text-gray-300 text-sm italic">Line items will appear here</td>
            </tr>
          ) : lineItems.map((item) => {
            const isActive = activeItemId === item.id;
            return (
              <tr key={item.id} className={`border-b border-gray-100 transition-colors ${isActive ? "bg-navy-50" : ""}`}>
                <td className="py-2 pr-3 text-gray-600 text-xs">{item.date || "—"}</td>
                <td className="py-2 pr-3 text-gray-700 text-xs">{item.employee || "—"}</td>
                <td className="py-2 pr-3 text-gray-700">
                  <EditableCell value={item.description} onFocus={() => onActivate(item.id)}
                    onCommit={(v) => onUpdateItem(item.id, "description", v)} placeholder="Description" className="text-sm" />
                </td>
                <td className="py-2 pr-3 text-right text-gray-500">
                  <EditableCell value={item.hours !== "" && item.hours !== 0 ? item.hours : ""} type="number"
                    onFocus={() => onActivate(item.id)} onCommit={(v) => onUpdateItem(item.id, "hours", v)}
                    placeholder="0" className="text-sm text-right" />
                </td>
                <td className="py-2 text-right font-medium text-gray-900">
                  <EditableCell value={item.amount} type="number" onFocus={() => onActivate(item.id)}
                    onCommit={(v) => onUpdateItem(item.id, "amount", v)} placeholder="0.00" className="text-sm text-right" />
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

      {notes && (
        <div className="border-t border-gray-100 pt-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-sm text-gray-600 whitespace-pre-line">{notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Job calendar picker modal ─────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_FULL    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DOW_SHORT   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

function fmtDs(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function JobCalendarModal({
  linkedJobIds, loadingJobId, onLink, onClose,
}: {
  linkedJobIds: Set<string>; loadingJobId: string | null;
  onLink: (job: CalendarEvent) => void; onClose: () => void;
}) {
  const [view, setView]     = useState<"month" | "week" | "day">("month");
  const [pivot, setPivot]   = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const today = todayStr();

  useEffect(() => {
    const p = (n: number) => String(n).padStart(2, "0");
    let from: string, to: string;
    if (view === "month") {
      const y = pivot.getFullYear(), m = pivot.getMonth();
      from = `${y}-${p(m + 1)}-01`;
      to   = `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}`;
    } else if (view === "week") {
      const mon = getMonday(pivot);
      from = fmtDs(mon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      to = fmtDs(sun);
    } else {
      from = to = fmtDs(pivot);
    }
    setLoading(true);
    createSupabaseBrowser()
      .from("job_events")
      .select("id, title, client, date")
      .gte("date", from).lte("date", to).order("date")
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, [view, pivot]);

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }

  function goPrev() {
    if (view === "month") setPivot(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
    else if (view === "week") setPivot(p => { const d = new Date(p); d.setDate(p.getDate() - 7); return d; });
    else setPivot(p => { const d = new Date(p); d.setDate(p.getDate() - 1); return d; });
  }
  function goNext() {
    if (view === "month") setPivot(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));
    else if (view === "week") setPivot(p => { const d = new Date(p); d.setDate(p.getDate() + 7); return d; });
    else setPivot(p => { const d = new Date(p); d.setDate(p.getDate() + 1); return d; });
  }
  function getTitle() {
    if (view === "month") return `${MONTH_NAMES[pivot.getMonth()]} ${pivot.getFullYear()}`;
    if (view === "week") {
      const mon = getMonday(pivot);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      if (mon.getMonth() === sun.getMonth())
        return `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}, ${mon.getFullYear()}`;
      return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}, ${sun.getFullYear()}`;
    }
    return `${DOW_FULL[pivot.getDay()]}, ${MONTH_NAMES[pivot.getMonth()]} ${pivot.getDate()}`;
  }

  function EventChip({ job }: { job: CalendarEvent }) {
    const linked = linkedJobIds.has(job.id);
    const busy   = loadingJobId === job.id;
    return (
      <button
        disabled={linked || busy}
        onClick={() => onLink(job)}
        title={`${job.title}${job.client ? ` · ${job.client}` : ""}`}
        className={`w-full text-left text-[11px] rounded px-1.5 py-0.5 mb-0.5 truncate font-medium transition-colors
          ${linked ? "bg-green-100 text-green-700 line-through opacity-60 cursor-default"
                   : "bg-navy-100 text-navy-800 hover:bg-navy-200 cursor-pointer"}`}
      >
        {busy ? "…" : job.title}
      </button>
    );
  }

  function renderMonth() {
    const y = pivot.getFullYear(), m = pivot.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const days     = new Date(y, m + 1, 0).getDate();
    const pad      = (n: number) => String(n).padStart(2, "0");
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return (
      <div className="flex-1 overflow-auto min-h-0">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DOW_SHORT.map(d => <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 border-l border-t border-gray-100">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="border-r border-b border-gray-100 min-h-[72px]" />;
            const ds = `${y}-${pad(m + 1)}-${pad(day)}`;
            const de = byDate[ds] ?? [];
            const isToday = ds === today;
            return (
              <div key={i} className="border-r border-b border-gray-100 min-h-[72px] p-1">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-0.5 ${isToday ? "bg-navy-600 text-white font-bold" : "text-gray-600 font-medium"}`}>{day}</span>
                {de.slice(0, 3).map(e => <EventChip key={e.id} job={e} />)}
                {de.length > 3 && <span className="text-[10px] text-gray-400 pl-1">+{de.length - 3} more</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeek() {
    const monday = getMonday(pivot);
    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
    return (
      <div className="flex-1 overflow-auto min-h-0">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d, i) => {
            const isToday = fmtDs(d) === today;
            return (
              <div key={i} className="py-2 text-center border-r border-gray-100 last:border-r-0">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{DOW_SHORT[d.getDay()]}</p>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm mx-auto mt-0.5 ${isToday ? "bg-navy-600 text-white font-bold" : "text-gray-700 font-medium"}`}>{d.getDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 border-l border-gray-100 min-h-[220px]">
          {weekDays.map((d, i) => {
            const ds = fmtDs(d);
            const de = byDate[ds] ?? [];
            return (
              <div key={i} className="border-r border-gray-100 last:border-r-0 p-1.5">
                {de.map(e => <EventChip key={e.id} job={e} />)}
                {de.length === 0 && <p className="text-[10px] text-gray-300 text-center pt-3">—</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDay() {
    const ds = fmtDs(pivot);
    const de = byDate[ds] ?? [];
    return (
      <div className="flex-1 overflow-auto px-5 py-4 min-h-0">
        {loading ? null : de.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No jobs scheduled for this day.</p>
        ) : (
          <div className="space-y-1">
            {de.map(job => {
              const linked = linkedJobIds.has(job.id);
              return (
                <div key={job.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{job.title}</p>
                    {job.client && <p className="text-xs text-gray-500 truncate">{job.client}</p>}
                  </div>
                  <button
                    disabled={linked || loadingJobId === job.id}
                    onClick={() => onLink(job)}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40
                      ${linked ? "bg-green-100 text-green-700 cursor-default" : "bg-navy-600 text-white hover:bg-navy-700"}`}
                  >
                    {linked ? "✓ Linked" : loadingJobId === job.id ? "…" : "+ Link"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl flex flex-col" style={{ height: "85vh", maxHeight: 680 }}>
        <div className="flex items-center px-4 py-3 border-b border-gray-100 gap-2 shrink-0">
          <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 12 6 8 10 4"/></svg>
          </button>
          <h3 className="flex-1 text-center font-semibold text-gray-900 text-sm">{getTitle()}</h3>
          <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 4 10 8 6 12"/></svg>
          </button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden ml-2">
            {(["month", "week", "day"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${view === v ? "bg-navy-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ml-1">
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
        {loading && <div className="h-0.5 bg-navy-200 animate-pulse shrink-0" />}
        {view === "month" && renderMonth()}
        {view === "week"  && renderWeek()}
        {view === "day"   && renderDay()}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">Click a job to link it · already-linked jobs are crossed out</span>
          <button onClick={onClose} className="text-sm font-semibold text-navy-600 hover:text-navy-800 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Invoice Page ─────────────────────────────────────────────────────────

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loadingInvoice, setLoadingInvoice] = useState(true);

  // Invoice meta
  const [invoiceNumber, setInvoiceNumber]     = useState("");
  const [invoiceDate, setInvoiceDate]         = useState(todayStr());
  const [companyName, setCompanyName]         = useState("");
  const [companyAddress, setCompanyAddress]   = useState("");
  const [clientName, setClientName]           = useState("");
  const [dateFrom, setDateFrom]               = useState("");
  const [dateTo, setDateTo]                   = useState("");
  const [notes, setNotes]                     = useState("");

  // Line items & linked jobs
  const [lineItems, setLineItems]   = useState<LineItemState[]>([]);
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);

  // Job search
  const [jobSearch, setJobSearch]         = useState("");
  const [jobResults, setJobResults]       = useState<JobResult[]>([]);
  const [jobSearchOpen, setJobSearchOpen] = useState(false);
  const [loadingJobId, setLoadingJobId]   = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());
  function toggleBreakdown(iid: string) {
    setExpandedBreakdowns((prev) => { const next = new Set(prev); next.has(iid) ? next.delete(iid) : next.add(iid); return next; });
  }

  const [calOpen, setCalOpen]         = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [mobileView, setMobileView]   = useState<"form" | "preview">("form");
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");

  // ── Load existing invoice ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/invoices/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setInvoiceNumber(data.invoice_number || "");
        setInvoiceDate(data.invoice_date || todayStr());
        setCompanyName(data.company_name || "");
        setCompanyAddress(data.company_address || "");
        setClientName(data.client_name || "");
        setDateFrom(data.date_from || "");
        setDateTo(data.date_to || "");
        setNotes(data.notes || "");
        setLineItems(
          (data.line_items || []).map((item: Record<string, unknown>) => ({
            id: crypto.randomUUID(),
            description: String(item.description || ""),
            employee: String(item.employee || ""),
            date: String(item.date || todayStr()),
            hours: item.hours ?? "",
            amount: String(item.amount ?? ""),
          }))
        );
        setLoadingInvoice(false);
      });
  }, [id]);

  // ── Job search ────────────────────────────────────────────────────────────
  const searchJobs = useCallback(async (term: string) => {
    if (!term.trim()) { setJobResults([]); setJobSearchOpen(false); return; }
    const { data } = await createSupabaseBrowser()
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setJobSearchOpen(false);
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
    if (!clientName && event.client) setClientName(event.client);
    setDateFrom((prev) => (!prev || event.date < prev) ? event.date : prev);
    setDateTo((prev) => (!prev || event.date > prev) ? event.date : prev);
  }

  function unlinkJob(eventId: string) {
    setLinkedJobs((prev) => prev.filter((j) => j.eventId !== eventId));
    setLineItems((prev) => prev.filter((item) => item.sourceJobId !== eventId));
    setLinkedJobs((prev) => {
      const remaining = prev.filter((j) => j.eventId !== eventId);
      if (remaining.length > 0) {
        const dates = remaining.map((j) => j.date).sort();
        setDateFrom(dates[0]); setDateTo(dates[dates.length - 1]);
      }
      return remaining;
    });
  }

  // ── Line item CRUD ────────────────────────────────────────────────────────
  function updateItem(iid: string, field: keyof LineItemState, value: string) {
    setLineItems((prev) => prev.map((item) => item.id === iid ? { ...item, [field]: value } : item));
  }
  function removeItem(iid: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== iid));
    if (activeItemId === iid) setActiveItemId(null);
  }
  function addBlankItem() { setLineItems((prev) => [...prev, blankItem()]); }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (!invoiceNumber.trim()) { setSaveError("Invoice number is required."); return; }
    if (!clientName.trim()) { setSaveError("Client name is required."); return; }
    setSaveError("");
    setSaving(true);

    const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const savedItems = lineItems.map(({ id: _id, sourceJobId: _sj, sourceJobTitle: _st, breakdown: _bd, priceBasis: _pb, ...rest }) => rest);

    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT",
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
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      router.push(`/admin/invoices/${id}`);
    } else {
      setSaveError(data.error ?? "Failed to save. Please try again.");
    }
  }

  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  if (loadingInvoice) return <p className="text-gray-500 p-8">Loading invoice…</p>;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="-mx-4 -mt-8">
      <div className="lg:hidden flex border-b border-gray-200 bg-white sticky top-0 z-20">
        {(["form", "preview"] as const).map((v) => (
          <button key={v} onClick={() => setMobileView(v)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${mobileView === v ? "text-navy-600 border-b-2 border-navy-600" : "text-gray-400"}`}>
            {v === "form" ? "Form" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[45%_55%]">
        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className={`${mobileView === "preview" ? "hidden lg:block" : "block"} px-4 pt-8 space-y-4 bg-gray-50 lg:bg-transparent`} style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Invoice</h1>
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Invoice Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice #</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Your Company Name</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Your Company Address</label>
                <input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client Name</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-1">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Work From</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Work To</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Payment terms, thank you message, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none" />
            </div>
          </div>

          {/* Link a Job */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-3">Link a Job</h2>
            <p className="text-xs text-gray-400 mb-3">
              Search your calendar jobs — linked hour logs are automatically added as line items.
            </p>
            {linkedJobs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {linkedJobs.map((job) => {
                  const count = lineItems.filter((i) => i.sourceJobId === job.eventId).length;
                  return (
                    <div key={job.eventId} className="flex items-center gap-1.5 bg-navy-50 border border-navy-200 rounded-full px-3 py-1 text-xs">
                      <span className="font-semibold text-navy-700">{job.title}</span>
                      <span className="text-navy-400">·</span>
                      <span className="text-navy-500">{count} {count === 1 ? "item" : "items"}</span>
                      <button onClick={() => unlinkJob(job.eventId)} className="ml-1 text-navy-400 hover:text-navy-700 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={searchRef} className="relative flex gap-2">
              <input value={jobSearch} onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search by job title or client…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                onFocus={() => { if (jobResults.length > 0) setJobSearchOpen(true); }} />
              <button type="button" onClick={() => setCalOpen(true)} title="Pick from calendar"
                className="shrink-0 border border-gray-300 rounded-lg px-2.5 py-2 text-gray-500 hover:text-navy-600 hover:border-navy-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="14" height="13" rx="2"/>
                  <line x1="3" y1="8" x2="17" y2="8"/>
                  <line x1="7" y1="2" x2="7" y2="5"/>
                  <line x1="13" y1="2" x2="13" y2="5"/>
                </svg>
              </button>
              {jobSearchOpen && jobResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                  {jobResults.map((job) => {
                    const alreadyLinked = linkedJobs.some((j) => j.eventId === job.id);
                    return (
                      <button key={job.id} disabled={alreadyLinked || loadingJobId === job.id}
                        onClick={() => linkJob(job)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                          <p className="text-xs text-gray-500">{job.client} · {job.date}</p>
                        </div>
                        {alreadyLinked ? <span className="text-xs text-navy-500 font-medium">Linked</span>
                          : loadingJobId === job.id ? <span className="text-xs text-gray-400">Loading…</span>
                          : <span className="text-xs text-navy-600 font-semibold">+ Add</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {jobSearch.trim() && jobSearchOpen && jobResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 px-4 py-3">
                  <p className="text-sm text-gray-400">No jobs found for &ldquo;{jobSearch}&rdquo;</p>
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
              <div className="space-y-1.5 mb-3">
                {lineItems.map((item) => {
                  const isActive = activeItemId === item.id;
                  const isExpanded = expandedBreakdowns.has(item.id);
                  const hasBreakdown = (item.breakdown && item.breakdown.length > 1) || (item.priceBasis && item.priceBasis.length > 0);
                  return (
                    <div key={item.id} className={`rounded-lg border transition-colors ${isActive ? "border-navy-300 bg-navy-50" : "border-transparent hover:bg-gray-50"}`}>
                      <div className="grid grid-cols-[1fr_auto] gap-2 p-2">
                        <div className="space-y-1.5">
                          {item.sourceJobTitle && (
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{item.sourceJobTitle}</span>
                          )}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[10px] text-gray-400">Employee</label>
                              <input value={item.employee} onChange={(e) => updateItem(item.id, "employee", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">Date</label>
                              <input type="date" value={item.date} onChange={(e) => updateItem(item.id, "date", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">Description</label>
                            <input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)}
                              onFocus={() => setActiveItemId(item.id)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[10px] text-gray-400">Hours</label>
                              <input type="number" min="0" step="0.25" value={item.hours}
                                onChange={(e) => updateItem(item.id, "hours", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">Amount ($)</label>
                              <input type="number" min="0" step="0.01" value={item.amount}
                                onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)} placeholder="0.00"
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="self-start mt-1 text-red-400 hover:text-red-600 p-1">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                          </svg>
                        </button>
                      </div>

                      {hasBreakdown && (
                        <div className="px-2 pb-2">
                          <button onClick={() => toggleBreakdown(item.id)}
                            className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-navy-700 font-medium transition-colors">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                              <polyline points="3 2 7 5 3 8"/>
                            </svg>
                            {item.breakdown && item.breakdown.length > 1 ? `${item.breakdown.length} entries merged` : "Pricing detail"}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 pl-3 border-l-2 border-navy-200 space-y-2">
                              {item.breakdown && item.breakdown.length > 1 && (
                                <div className="space-y-0.5">
                                  {item.breakdown.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between text-[11px]">
                                      <span className="text-gray-700"><span className="font-medium">{b.employee}</span><span className="text-gray-400"> · {b.date}</span></span>
                                      <span className="text-gray-600 font-medium tabular-nums">{b.hours}h</span>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-gray-200 mt-0.5">
                                    <span className="text-gray-500 font-semibold">Total</span>
                                    <span className="text-gray-800 font-bold tabular-nums">{item.breakdown.reduce((s, b) => s + b.hours, 0).toFixed(2)}h</span>
                                  </div>
                                </div>
                              )}
                              {item.priceBasis && item.priceBasis.length > 0 && (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">How amount was calculated</p>
                                  {item.priceBasis.map((line, i) => (
                                    <p key={i} className="text-[11px] text-gray-600 font-mono">{line}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
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
            <button onClick={save} disabled={saving}
              className="bg-navy-600 hover:bg-navy-700 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-2.5 text-sm">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
          {saveError && <p className="text-red-500 text-sm text-center">{saveError}</p>}
        </div>

        {/* ── RIGHT PANEL (preview) ───────────────────────────────────────── */}
        <div className={`${mobileView === "form" ? "hidden lg:block" : "block"} border-l border-gray-200 bg-gray-50 px-4 py-8`}
          style={{ position: "sticky", top: 72, alignSelf: "start", maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Live Preview
            <span className="normal-case font-normal ml-2 text-gray-300">· click any field to edit</span>
          </p>
          <InvoicePreview
            invoiceNumber={invoiceNumber} invoiceDate={invoiceDate}
            companyName={companyName} companyAddress={companyAddress}
            clientName={clientName} dateFrom={dateFrom} dateTo={dateTo}
            notes={notes} lineItems={lineItems} activeItemId={activeItemId}
            onActivate={setActiveItemId} onUpdateItem={updateItem}
          />
        </div>
      </div>

      {calOpen && (
        <JobCalendarModal
          linkedJobIds={new Set(linkedJobs.map((j) => j.eventId))}
          loadingJobId={loadingJobId}
          onLink={(job) => linkJob({ id: job.id, title: job.title, client: job.client, date: job.date })}
          onClose={() => setCalOpen(false)}
        />
      )}
    </div>
  );
}
