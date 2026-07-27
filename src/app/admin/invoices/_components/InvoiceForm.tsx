"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export interface ColumnDef {
  id: string;
  label: string;
  type: "date" | "employee" | "description" | "rate" | "hours" | "amount" | "custom";
  visible: boolean;
}

interface LineItemState {
  id: string;
  description: string;
  employee: string;
  date: string;
  hours: number | string;
  amount: string;
  rate?: string;
  sourceJobId?: string;
  sourceJobTitle?: string;
  breakdown?: BreakdownEntry[];
  priceBasis?: string[];
  customValues?: Record<string, string>;
}

interface WorkItemDisplay {
  slug: string;
  typeName: string;
  hours: string;
  description: string;
}

interface PendingSubmission {
  submissionId: string;
  employee: string;
  date: string;
  workItems: WorkItemDisplay[];
  lineItems: LineItemState[];
}

interface LinkedJob {
  eventId: string;
  title: string;
  client: string;
  date: string;
  pendingSubmissions: PendingSubmission[];
}

interface AddedSubmission {
  submissionId: string;
  employee: string;
  date: string;
  jobEventId: string;
  jobTitle: string;
  workItems: WorkItemDisplay[];
  workItemLineItemIds: string[];  // parallel to workItems; [i] = line item ID for workItems[i]
  lineItemIds: string[];  // unique set of workItemLineItemIds (for bulk/sibling ops)
  originalSubmission: PendingSubmission;
}

interface JobResult {
  id: string;
  title: string;
  client: string;
  date: string;
}

interface OngoingJobOption {
  id: string;
  title: string;
  client: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "date",        label: "Date",        type: "date",        visible: true },
  { id: "employee",    label: "Employee",    type: "employee",    visible: true },
  { id: "description", label: "Description", type: "description", visible: true },
  { id: "rate",        label: "Rate",        type: "rate",        visible: true },
  { id: "hours",       label: "Hours",       type: "hours",       visible: true },
  { id: "amount",      label: "Amount",      type: "amount",      visible: true },
];

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

function formatShortDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function blankItem(): LineItemState {
  return { id: crypto.randomUUID(), description: "", employee: "", date: todayStr(), hours: "", amount: "", customValues: {} };
}

// Map each workItem to the line item ID it contributes to, by description (not index).
// lineItems from the API are alphabetically sorted while workItems follow raw entry order,
// so index-based mapping is unreliable — description matching is the correct approach.
function mapWorkItemsToLineItemIds(
  workItems: WorkItemDisplay[],
  subLineItems: LineItemState[],
  mergedIds: string[],
): string[] {
  const descToId: Record<string, string> = {};
  subLineItems.forEach((li, i) => { if (mergedIds[i]) descToId[li.description] = mergedIds[i]; });
  return workItems.map((wi) => descToId[wi.description] ?? "");
}

// Merge newItems into currentItems. Items sharing description+rate are combined into one row.
// Returns the updated items array and the IDs affected (existing item ID if merged, new ID if appended).
function mergeIntoExisting(
  currentItems: LineItemState[],
  newItems: LineItemState[],
): { nextItems: LineItemState[]; mergedIds: string[] } {
  const next = [...currentItems];
  const mergedIds: string[] = [];

  for (const newItem of newItems) {
    const key = `${newItem.description}||${newItem.rate ?? ""}`;
    const idx = next.findIndex((i) => `${i.description}||${i.rate ?? ""}` === key);

    if (idx >= 0) {
      const cur = next[idx];
      const curBreakdown: BreakdownEntry[] =
        cur.breakdown && cur.breakdown.length > 0
          ? cur.breakdown
          : cur.employee && cur.hours
            ? [{ employee: cur.employee, date: cur.date, hours: parseFloat(String(cur.hours)) || 0 }]
            : [];
      const newBreakdown: BreakdownEntry[] =
        newItem.breakdown && newItem.breakdown.length > 0
          ? newItem.breakdown
          : newItem.employee && newItem.hours
            ? [{ employee: newItem.employee, date: newItem.date, hours: parseFloat(String(newItem.hours)) || 0 }]
            : [];
      const allBreakdowns = [...curBreakdown, ...newBreakdown].sort(
        (a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee),
      );
      const totalHours = Math.round(allBreakdowns.reduce((s, b) => s + b.hours, 0) * 100) / 100;
      const totalAmount = (parseFloat(cur.amount) || 0) + (parseFloat(newItem.amount) || 0);
      const employees = [...new Set(allBreakdowns.map((b) => b.employee))];
      const employeeLabel =
        employees.length === 0 ? ""
        : employees.length === 1 ? employees[0]
        : employees.length === 2 ? employees.join(" & ")
        : `${employees.length} employees`;
      next[idx] = {
        ...cur,
        employee: employeeLabel,
        hours: totalHours,
        amount: totalAmount > 0 ? totalAmount.toFixed(2) : cur.amount,
        date: allBreakdowns[0]?.date ?? cur.date,
        breakdown: allBreakdowns.length > 1 ? allBreakdowns : undefined,
      };
      mergedIds.push(cur.id);
    } else {
      next.push(newItem);
      mergedIds.push(newItem.id);
    }
  }

  return { nextItems: next, mergedIds };
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${on ? "bg-navy-600" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value, type = "text", onCommit, onFocus, className = "", placeholder = "—",
}: {
  value: string | number; type?: "text" | "number"; onCommit: (val: string) => void;
  onFocus: () => void; className?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));
  useEffect(() => { if (!editing) setLocal(String(value)); }, [value, editing]);

  if (editing) {
    return (
      <input autoFocus type={type} value={local} min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined} onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(local); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); onCommit(local); } }}
        className={`bg-transparent border-b border-navy-400 outline-none ${className}`}
        style={{ width: "100%", minWidth: 40 }} />
    );
  }
  return (
    <span onClick={() => { setEditing(true); onFocus(); }} title="Click to edit"
      className={`cursor-text rounded px-0.5 hover:bg-navy-50 transition-colors ${className}`}>
      {String(value) !== "" ? String(value) : <span className="text-gray-300">{placeholder}</span>}
    </span>
  );
}

// ── Invoice preview ───────────────────────────────────────────────────────────

function InvoicePreview({
  invoiceNumber, invoiceDate, companyName, companyAddress, clientName,
  dateFrom, dateTo, notes, lineItems, columns, activeItemId, onActivate,
  onUpdateItem, onUpdateCustomValue,
}: {
  invoiceNumber: string; invoiceDate: string; companyName: string; companyAddress: string;
  clientName: string; dateFrom: string; dateTo: string; notes: string;
  lineItems: LineItemState[]; columns: ColumnDef[]; activeItemId: string | null;
  onActivate: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItemState, value: string) => void;
  onUpdateCustomValue: (id: string, colId: string, value: string) => void;
}) {
  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const visibleCols = columns.filter((c) => c.visible);
  const colCount = Math.max(1, visibleCols.length);

  function thClass(col: ColumnDef) {
    const base = "py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide";
    if (col.type === "hours" || col.type === "amount") return `${base} text-right pr-${col.type === "hours" ? "3" : "0"} w-${col.type === "hours" ? "14" : "20"}`;
    if (col.type === "rate") return `${base} text-right pr-3 w-20`;
    if (col.type === "date") return `${base} text-left pr-3 w-24`;
    if (col.type === "employee") return `${base} text-left pr-3 w-28`;
    return `${base} text-left pr-3`;
  }

  function renderCell(col: ColumnDef, item: LineItemState) {
    switch (col.type) {
      case "date": return <td key={col.id} className="py-2 pr-3 text-gray-600 text-xs">{item.date || "—"}</td>;
      case "employee": return <td key={col.id} className="py-2 pr-3 text-gray-700 text-xs">{item.employee || "—"}</td>;
      case "description": return (
        <td key={col.id} className="py-2 pr-3 text-gray-700">
          <EditableCell value={item.description} onFocus={() => onActivate(item.id)}
            onCommit={(v) => onUpdateItem(item.id, "description", v)} placeholder="Description" className="text-sm" />
        </td>
      );
      case "rate": return (
        <td key={col.id} className="py-2 pr-3 text-right text-gray-500">
          <EditableCell value={item.rate ?? ""} onFocus={() => onActivate(item.id)}
            onCommit={(v) => onUpdateItem(item.id, "rate", v)} placeholder="—" className="text-sm text-right" />
        </td>
      );
      case "hours": return (
        <td key={col.id} className="py-2 pr-3 text-right text-gray-500">
          <EditableCell value={item.hours !== "" && item.hours !== 0 ? item.hours : ""} type="number"
            onFocus={() => onActivate(item.id)} onCommit={(v) => onUpdateItem(item.id, "hours", v)}
            placeholder="0" className="text-sm text-right" />
        </td>
      );
      case "amount": return (
        <td key={col.id} className="py-2 text-right font-medium text-gray-900">
          <EditableCell value={item.amount} type="number" onFocus={() => onActivate(item.id)}
            onCommit={(v) => onUpdateItem(item.id, "amount", v)} placeholder="0.00" className="text-sm text-right" />
        </td>
      );
      case "custom": return (
        <td key={col.id} className="py-2 pr-3 text-gray-700">
          <EditableCell value={item.customValues?.[col.id] ?? ""} onFocus={() => onActivate(item.id)}
            onCommit={(v) => onUpdateCustomValue(item.id, col.id, v)} placeholder="—" className="text-sm" />
        </td>
      );
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[600px]">
      <div className="flex justify-between items-start mb-8">
        <div>
          {companyName && <div className="text-xl font-bold text-gray-900 mb-1">{companyName}</div>}
          {companyAddress && <div className="text-sm text-gray-500 whitespace-pre-line">{companyAddress}</div>}
          {!companyName && !companyAddress && <div className="text-sm text-gray-300 italic">Your company name &amp; address</div>}
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
          <tr className="border-b-2 border-gray-200">
            {visibleCols.map((col) => <th key={col.id} className={thClass(col)}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr><td colSpan={colCount} className="py-6 text-center text-gray-300 text-sm italic">Line items will appear here</td></tr>
          ) : lineItems.map((item) => {
            const isActive = activeItemId === item.id;
            return (
              <tr key={item.id} className={`border-b border-gray-100 transition-colors ${isActive ? "bg-navy-50" : ""}`}>
                {visibleCols.map((col) => renderCell(col, item))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={Math.max(1, colCount - 1)} className="text-right py-3 pr-3 font-bold text-gray-700 text-base">Total</td>
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
      <div className="mt-6 text-center text-xs text-gray-300 uppercase tracking-widest">— Draft —</div>
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
  const m = new Date(d); m.setDate(d.getDate() + diff); return m;
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
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); to = fmtDs(sun);
    } else {
      from = to = fmtDs(pivot);
    }
    setLoading(true);
    createSupabaseBrowser().from("job_events").select("id, title, client, date")
      .gte("date", from).lte("date", to).order("date")
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, [view, pivot]);

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); }

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
      if (mon.getMonth() === sun.getMonth()) return `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}, ${mon.getFullYear()}`;
      return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}, ${sun.getFullYear()}`;
    }
    return `${DOW_FULL[pivot.getDay()]}, ${MONTH_NAMES[pivot.getMonth()]} ${pivot.getDate()}`;
  }

  function EventChip({ job }: { job: CalendarEvent }) {
    const linked = linkedJobIds.has(job.id);
    const busy   = loadingJobId === job.id;
    return (
      <button disabled={linked || busy} onClick={() => onLink(job)}
        title={`${job.title}${job.client ? ` · ${job.client}` : ""}`}
        className={`w-full text-left text-[11px] rounded px-1.5 py-0.5 mb-0.5 truncate font-medium transition-colors
          ${linked ? "bg-green-100 text-green-700 line-through opacity-60 cursor-default"
                   : "bg-navy-100 text-navy-800 hover:bg-navy-200 cursor-pointer"}`}>
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
                  <button disabled={linked || loadingJobId === job.id} onClick={() => onLink(job)}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${linked ? "bg-green-100 text-green-700 cursor-default" : "bg-navy-600 text-white hover:bg-navy-700"}`}>
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
                className={`px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${view === v ? "bg-navy-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>{v}</button>
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
          <span className="text-xs text-gray-400">Click a job to link it — the modal closes automatically</span>
          <button onClick={onClose} className="text-sm font-semibold text-navy-600 hover:text-navy-800 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvoiceForm({
  mode,
  invoiceId,
}: {
  mode: "new" | "edit";
  invoiceId?: string;
}) {
  const router = useRouter();

  const isLoadingRef = useRef(mode === "edit");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [invoiceNumber, setInvoiceNumber]     = useState("");
  const [invoiceDate, setInvoiceDate]         = useState(todayStr());
  const [companyName, setCompanyName]         = useState("");
  const [companyAddress, setCompanyAddress]   = useState("");
  const [clientName, setClientName]           = useState("");
  const [dateFrom, setDateFrom]               = useState("");
  const [dateTo, setDateTo]                   = useState("");
  const [notes, setNotes]                     = useState("");

  const [lineItems, setLineItems]             = useState<LineItemState[]>([]);
  const [linkedJobs, setLinkedJobs]           = useState<LinkedJob[]>([]);
  const [addedSubmissions, setAddedSubmissions] = useState<AddedSubmission[]>([]);

  const [columnConfig, setColumnConfig]       = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [addingCol, setAddingCol]             = useState(false);
  const [newColLabel, setNewColLabel]         = useState("");

  const [jobSearch, setJobSearch]             = useState("");
  const [jobResults, setJobResults]           = useState<JobResult[]>([]);
  const [jobSearchOpen, setJobSearchOpen]     = useState(false);
  const [loadingJobId, setLoadingJobId]       = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [ongoingJobs, setOngoingJobs]         = useState<OngoingJobOption[]>([]);
  const [ongoingPickerOpen, setOngoingPickerOpen] = useState(false);
  const [linkingOngoingId, setLinkingOngoingId] = useState<string | null>(null);
  const ongoingRef = useRef<HTMLDivElement>(null);

  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set());
  const [expandedBreakdowns, setExpandedBreakdowns]   = useState<Set<string>>(new Set());

  const [calOpen, setCalOpen]                 = useState(false);
  const [activeItemId, setActiveItemId]       = useState<string | null>(null);
  const [mobileView, setMobileView]           = useState<"form" | "preview">("form");
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState("");
  const [autoSaveStatus, setAutoSaveStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loadingInvoice, setLoadingInvoice]   = useState(mode === "edit");

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "new") {
      fetch("/api/invoices").then((r) => r.json()).then((data: { invoice_number: string }[]) => {
        const nums = Array.isArray(data) ? data.map((d) => d.invoice_number) : [];
        setInvoiceNumber(nextInvoiceNumber(nums));
      });
      return;
    }

    // edit mode
    async function load() {
      const res = await fetch(`/api/invoices/${invoiceId}`, { credentials: "include" });
      const data = await res.json();
      setInvoiceNumber(data.invoice_number || "");
      setInvoiceDate(data.invoice_date || todayStr());
      setCompanyName(data.company_name || "");
      setCompanyAddress(data.company_address || "");
      setClientName(data.client_name || "");
      setDateFrom(data.date_from || "");
      setDateTo(data.date_to || "");
      setNotes(data.notes || "");
      if (Array.isArray(data.column_config) && data.column_config.length > 0) {
        setColumnConfig(data.column_config as ColumnDef[]);
      }
      const loadedItems = (data.line_items || []).map((item: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        description: String(item.description || ""),
        employee: String(item.employee || ""),
        date: String(item.date || todayStr()),
        hours: item.hours ?? "",
        amount: String(item.amount ?? ""),
        rate: item.rate ? String(item.rate) : undefined,
        sourceJobId: item.sourceJobId ? String(item.sourceJobId) : undefined,
        sourceJobTitle: item.sourceJobTitle ? String(item.sourceJobTitle) : undefined,
        customValues: (item.customValues as Record<string, string>) ?? {},
      }));
      setLineItems(loadedItems);

      // Restore linked jobs and re-match submissions to the already-loaded line items
      const jobIds = [...new Set(
        loadedItems
          .filter((i: { sourceJobId?: string }) => i.sourceJobId)
          .map((i: { sourceJobId?: string }) => i.sourceJobId as string)
      )];
      if (jobIds.length > 0) {
        const { data: events } = await createSupabaseBrowser()
          .from("job_events")
          .select("id, title, client, date")
          .in("id", jobIds);

        if (events && events.length > 0) {
          // Fetch each job's submissions in parallel
          const jobFetches = await Promise.all(
            (events as { id: string; title: string; client: string; date: string }[]).map(async (ev) => {
              const res = await fetch(`/api/invoices/job-entries?eventId=${ev.id}`, { credentials: "include" });
              const subData = res.ok ? await res.json() : { submissions: [] };
              const submissions: PendingSubmission[] = (subData.submissions ?? []).map((s: PendingSubmission) => ({
                ...s,
                lineItems: s.lineItems.map((li) => ({ ...li, customValues: {} })),
              }));
              return { ev, submissions };
            })
          );

          const restoredJobs: LinkedJob[] = [];
          const restoredAdded: AddedSubmission[] = [];

          for (const { ev, submissions } of jobFetches) {
            // Loaded invoice line items that belong to this job
            const jobLineItems = loadedItems.filter(
              (li: { sourceJobId?: string }) => li.sourceJobId === ev.id
            ) as LineItemState[];

            const pending: PendingSubmission[] = [];

            for (const sub of submissions) {
              // Map each workItem to its loaded line item ID by description
              const workItemLineItemIds = sub.workItems.map((wi) => {
                const origLi = sub.lineItems.find((li) => li.description === wi.description);
                if (!origLi) return "";
                const invoiceLi = jobLineItems.find((li) => li.description === origLi.description);
                return invoiceLi ? invoiceLi.id : "";
              });

              if (workItemLineItemIds.some((id) => id !== "")) {
                restoredAdded.push({
                  submissionId: sub.submissionId,
                  employee: sub.employee,
                  date: sub.date,
                  jobEventId: ev.id,
                  jobTitle: ev.title,
                  workItems: sub.workItems,
                  workItemLineItemIds,
                  lineItemIds: [...new Set(workItemLineItemIds)].filter(Boolean),
                  originalSubmission: sub,
                });
              } else {
                pending.push(sub);
              }
            }

            restoredJobs.push({
              eventId: ev.id,
              title: ev.title,
              client: ev.client,
              date: ev.date,
              pendingSubmissions: pending,
            });
          }

          setLinkedJobs(restoredJobs);
          setAddedSubmissions(restoredAdded);
        }
      }
      isLoadingRef.current = false;
      setLoadingInvoice(false);
    }
    load();
  }, [mode, invoiceId]);

  // ── Auto-save (edit mode only) ────────────────────────────────────────────
  useEffect(() => {
    if (isLoadingRef.current || mode !== "edit" || !invoiceId) return;
    if (!invoiceNumber.trim() || !clientName.trim()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const savedItems = lineItems.map(({ id: _id, breakdown: _bd, priceBasis: _pb, ...rest }) => rest);
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            invoice_number: invoiceNumber, client_name: clientName,
            date_from: dateFrom || todayStr(), date_to: dateTo || todayStr(),
            invoice_date: invoiceDate, company_name: companyName || null,
            company_address: companyAddress || null, line_items: savedItems,
            total, notes: notes || null, column_config: columnConfig,
          }),
        });
        const data = await res.json();
        setAutoSaveStatus(data.ok ? "saved" : "error");
      } catch {
        setAutoSaveStatus("error");
      }
    }, 2500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [invoiceNumber, invoiceDate, companyName, companyAddress, clientName, dateFrom, dateTo, notes, lineItems, columnConfig, mode, invoiceId]);

  useEffect(() => {
    if (autoSaveStatus !== "saved") return;
    const t = setTimeout(() => setAutoSaveStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [autoSaveStatus]);

  // ── Column helpers ────────────────────────────────────────────────────────
  function toggleColumn(id: string) {
    setColumnConfig((prev) => prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  }
  function addCustomColumn() {
    const label = newColLabel.trim();
    if (!label) return;
    setColumnConfig((prev) => [...prev, { id: crypto.randomUUID(), label, type: "custom", visible: true }]);
    setNewColLabel(""); setAddingCol(false);
  }
  function removeCustomColumn(id: string) {
    setColumnConfig((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Job search ────────────────────────────────────────────────────────────
  const searchJobs = useCallback(async (term: string) => {
    if (!term.trim()) { setJobResults([]); setJobSearchOpen(false); return; }
    const { data } = await createSupabaseBrowser().from("job_events").select("id, title, client, date")
      .or(`title.ilike.%${term}%,client.ilike.%${term}%`).order("date", { ascending: false }).limit(8);
    setJobResults(data ?? []); setJobSearchOpen(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchJobs(jobSearch), 300);
    return () => clearTimeout(t);
  }, [jobSearch, searchJobs]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setJobSearchOpen(false);
      if (ongoingRef.current && !ongoingRef.current.contains(e.target as Node)) setOngoingPickerOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    fetch("/api/ongoing-jobs", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setOngoingJobs(Array.isArray(data) ? data : []));
  }, []);

  // ── Link every calendar entry under an ongoing job in one go — the whole
  // point of an ongoing job is that hours logged on any day of it should
  // roll into the same invoice, regardless of which specific day it was. ──
  async function linkOngoingJob(ongoingJobId: string) {
    setLinkingOngoingId(ongoingJobId);
    setOngoingPickerOpen(false);
    try {
      const res = await fetch(`/api/events?ongoingJobId=${ongoingJobId}`, { credentials: "include" });
      const jobs: JobResult[] = await res.json();
      if (!Array.isArray(jobs)) return;
      for (const job of jobs) {
        await linkJob(job);
      }
    } finally {
      setLinkingOngoingId(null);
    }
  }

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

    const { event, submissions } = data as {
      event: { id: string; title: string; client: string; date: string };
      submissions: PendingSubmission[];
    };

    setLinkedJobs((prev) => [...prev, {
      eventId: job.id,
      title: event.title,
      client: event.client,
      date: event.date,
      pendingSubmissions: submissions.map((s) => ({
        ...s,
        lineItems: s.lineItems.map((i) => ({ ...i, customValues: {} })),
      })),
    }]);

    if (!clientName && event.client) setClientName(event.client);
  }

  // ── Unlink a job ──────────────────────────────────────────────────────────
  function unlinkJob(eventId: string) {
    setLinkedJobs((prev) => prev.filter((j) => j.eventId !== eventId));
    setLineItems((items) => items.filter((item) => item.sourceJobId !== eventId));
    setAddedSubmissions((prev) => prev.filter((s) => s.jobEventId !== eventId));
  }

  // ── Add a single submission ───────────────────────────────────────────────
  function addSubmission(eventId: string, submissionId: string) {
    const job = linkedJobs.find((j) => j.eventId === eventId);
    if (!job) return;
    const sub = job.pendingSubmissions.find((s) => s.submissionId === submissionId);
    if (!sub) return;

    const { nextItems, mergedIds } = mergeIntoExisting(lineItems, sub.lineItems);
    setLineItems(nextItems);
    setLinkedJobs((prev) => prev.map((j) =>
      j.eventId === eventId ? { ...j, pendingSubmissions: j.pendingSubmissions.filter((s) => s.submissionId !== submissionId) } : j
    ));
    const workItemLineItemIds = mapWorkItemsToLineItemIds(sub.workItems, sub.lineItems, mergedIds);
    setAddedSubmissions((prev) => [...prev, {
      submissionId: sub.submissionId,
      employee: sub.employee,
      date: sub.date,
      jobEventId: eventId,
      jobTitle: job.title,
      workItems: sub.workItems,
      workItemLineItemIds,
      lineItemIds: [...new Set(mergedIds)],
      originalSubmission: sub,
    }]);

    const dates = sub.lineItems.map((e) => e.date).filter(Boolean).sort();
    if (dates.length > 0) {
      setDateFrom((prev) => (!prev || dates[0] < prev) ? dates[0] : prev);
      setDateTo((prev) => (!prev || dates[dates.length - 1] > prev) ? dates[dates.length - 1] : prev);
    }
  }

  // ── Add all submissions for a job ─────────────────────────────────────────
  function addAllSubmissionsForJob(eventId: string) {
    const job = linkedJobs.find((j) => j.eventId === eventId);
    if (!job || job.pendingSubmissions.length === 0) return;
    const rawItems = job.pendingSubmissions.flatMap((s) => s.lineItems);
    const { nextItems, mergedIds } = mergeIntoExisting(lineItems, rawItems);
    setLineItems(nextItems);
    // Slice mergedIds back per-submission, then map by description so pill order doesn't matter
    let offset = 0;
    const newAdded = job.pendingSubmissions.map((sub) => {
      const subMergedIds = mergedIds.slice(offset, offset + sub.lineItems.length);
      offset += sub.lineItems.length;
      const workItemLineItemIds = mapWorkItemsToLineItemIds(sub.workItems, sub.lineItems, subMergedIds);
      return {
        submissionId: sub.submissionId,
        employee: sub.employee,
        date: sub.date,
        jobEventId: eventId,
        jobTitle: job.title,
        workItems: sub.workItems,
        workItemLineItemIds,
        lineItemIds: [...new Set(subMergedIds)],
        originalSubmission: sub,
      };
    });
    setAddedSubmissions((prev) => [...prev, ...newAdded]);
    setLinkedJobs((prev) => prev.map((j) => j.eventId === eventId ? { ...j, pendingSubmissions: [] } : j));
    const dates = nextItems.map((e) => e.date).filter(Boolean).sort();
    if (dates.length > 0) {
      setDateFrom((prev) => (!prev || dates[0] < prev) ? dates[0] : prev);
      setDateTo((prev) => (!prev || dates[dates.length - 1] > prev) ? dates[dates.length - 1] : prev);
    }
  }

  // ── Add all submissions across all jobs ───────────────────────────────────
  function addAllSubmissions() {
    if (linkedJobs.every((j) => j.pendingSubmissions.length === 0)) return;
    let running = lineItems;
    const newAddedSubmissions: AddedSubmission[] = [];
    for (const j of linkedJobs) {
      if (j.pendingSubmissions.length === 0) continue;
      const rawItems = j.pendingSubmissions.flatMap((s) => s.lineItems);
      const { nextItems, mergedIds } = mergeIntoExisting(running, rawItems);
      running = nextItems;
      // Slice mergedIds per-submission, then map by description so pill order doesn't matter
      let offset = 0;
      for (const sub of j.pendingSubmissions) {
        const subMergedIds = mergedIds.slice(offset, offset + sub.lineItems.length);
        offset += sub.lineItems.length;
        const workItemLineItemIds = mapWorkItemsToLineItemIds(sub.workItems, sub.lineItems, subMergedIds);
        newAddedSubmissions.push({
          submissionId: sub.submissionId,
          employee: sub.employee,
          date: sub.date,
          jobEventId: j.eventId,
          jobTitle: j.title,
          workItems: sub.workItems,
          workItemLineItemIds,
          lineItemIds: [...new Set(subMergedIds)],
          originalSubmission: sub,
        });
      }
    }
    setLineItems(running);
    setAddedSubmissions((prev) => [...prev, ...newAddedSubmissions]);
    setLinkedJobs((prev) => prev.map((j) => ({ ...j, pendingSubmissions: [] })));
    const dates = running.map((e) => e.date).filter(Boolean).sort();
    if (dates.length > 0) {
      setDateFrom((prev) => (!prev || dates[0] < prev) ? dates[0] : prev);
      setDateTo((prev) => (!prev || dates[dates.length - 1] > prev) ? dates[dates.length - 1] : prev);
    }
  }

  // ── Remove an added submission (restores to pending) ──────────────────────
  // Only removes this submission. Shared merged line items are rebuilt from the
  // remaining contributors' original data — other submissions are never auto-removed.
  function removeAddedSubmission(submissionId: string) {
    const added = addedSubmissions.find((s) => s.submissionId === submissionId);
    if (!added) return;

    const removedIdSet = new Set(added.lineItemIds);
    const remaining = addedSubmissions.filter((s) => s.submissionId !== submissionId);

    let workingItems = lineItems;
    let workingRemaining = remaining;

    for (const lineItemId of removedIdSet) {
      const existsInInvoice = workingItems.some((li) => li.id === lineItemId);
      // Other submissions that also contributed to this merged row
      const contributors = workingRemaining.filter((s) => s.lineItemIds.includes(lineItemId));

      workingItems = workingItems.filter((li) => li.id !== lineItemId);

      if (existsInInvoice && contributors.length > 0) {
        // Rebuild the row from remaining contributors' original per-submission data
        const origLineItems: LineItemState[] = [];
        for (const c of contributors) {
          c.workItemLineItemIds.forEach((id, idx) => {
            if (id !== lineItemId) return;
            const wi = c.workItems[idx];
            const origLi = c.originalSubmission.lineItems.find((li) => li.description === wi.description);
            if (origLi) origLineItems.push(origLi);
          });
        }
        if (origLineItems.length > 0) {
          const { nextItems, mergedIds: rebuildIds } = mergeIntoExisting(workingItems, origLineItems);
          workingItems = nextItems;
          const newId = rebuildIds[0];
          workingRemaining = workingRemaining.map((s) => {
            if (!s.lineItemIds.includes(lineItemId)) return s;
            const newWorkItemIds = s.workItemLineItemIds.map((id) => id === lineItemId ? newId : id);
            return { ...s, workItemLineItemIds: newWorkItemIds, lineItemIds: [...new Set(newWorkItemIds)] };
          });
        }
      }
    }

    setLineItems(workingItems);
    setAddedSubmissions(workingRemaining);
    if (activeItemId && removedIdSet.has(activeItemId)) setActiveItemId(null);
    setLinkedJobs((prev) =>
      prev.map((j) =>
        j.eventId === added.jobEventId
          ? { ...j, pendingSubmissions: [...j.pendingSubmissions, added.originalSubmission] }
          : j
      )
    );
  }

  // ── Remove just one pill's contribution (rebuilds the shared row without this person) ──
  function removeWorkItem(submissionId: string, workItemIndex: number) {
    const added = addedSubmissions.find((s) => s.submissionId === submissionId);
    if (!added) return;
    const lineItemId = added.workItemLineItemIds[workItemIndex];
    if (!lineItemId) return;

    // Other submissions that also contributed to this same merged row
    const otherContributors = addedSubmissions.filter(
      (s) => s.submissionId !== submissionId && s.lineItemIds.includes(lineItemId)
    );

    // Remove the old merged row
    let workingItems = lineItems.filter((li) => li.id !== lineItemId);
    let newId: string | null = null;

    if (otherContributors.length > 0) {
      // Rebuild the row from everyone else's original per-submission data
      const origLineItems: LineItemState[] = [];
      for (const c of otherContributors) {
        c.workItemLineItemIds.forEach((id, idx) => {
          if (id !== lineItemId) return;
          const cwi = c.workItems[idx];
          const origLi = c.originalSubmission.lineItems.find((li) => li.description === cwi.description);
          if (origLi) origLineItems.push(origLi);
        });
      }
      if (origLineItems.length > 0) {
        const { nextItems, mergedIds: rebuildIds } = mergeIntoExisting(workingItems, origLineItems);
        workingItems = nextItems;
        newId = rebuildIds[0];
      }
    }

    setLineItems(workingItems);
    if (activeItemId === lineItemId) setActiveItemId(null);

    setAddedSubmissions((prev) =>
      prev.map((s) => {
        if (s.submissionId === submissionId) {
          // This pill goes amber — blank out just this index
          const newWorkItemIds = [...s.workItemLineItemIds];
          newWorkItemIds[workItemIndex] = "";
          return { ...s, workItemLineItemIds: newWorkItemIds, lineItemIds: newWorkItemIds.filter(Boolean) };
        }
        if (newId && s.lineItemIds.includes(lineItemId)) {
          // Other contributors point to the newly rebuilt row
          const newWorkItemIds = s.workItemLineItemIds.map((id) => id === lineItemId ? newId! : id);
          return { ...s, workItemLineItemIds: newWorkItemIds, lineItemIds: [...new Set(newWorkItemIds)].filter(Boolean) };
        }
        return s;
      })
    );
  }

  // ── Re-add a single pill whose line item was manually deleted ────────────
  function reAddWorkItem(submissionId: string, workItemIndex: number) {
    const added = addedSubmissions.find((s) => s.submissionId === submissionId);
    if (!added) return;
    const wi = added.workItems[workItemIndex];
    if (!wi) return;
    // Find original line item by description (not index — API sorts lineItems alphabetically)
    const singleLineItem = added.originalSubmission.lineItems.find((li) => li.description === wi.description);
    if (!singleLineItem) return;
    const oldId = added.workItemLineItemIds[workItemIndex];
    const { nextItems, mergedIds } = mergeIntoExisting(lineItems, [singleLineItem]);
    const newId = mergedIds[0];
    setLineItems(nextItems);
    setAddedSubmissions((prev) =>
      prev.map((s) => {
        if (s.submissionId === submissionId) {
          const newWorkItemIds = [...s.workItemLineItemIds];
          newWorkItemIds[workItemIndex] = newId;
          return { ...s, workItemLineItemIds: newWorkItemIds, lineItemIds: [...new Set(newWorkItemIds)].filter(Boolean) };
        }
        if (oldId && s.workItemLineItemIds.includes(oldId)) {
          const newWorkItemIds = s.workItemLineItemIds.map((id) => id === oldId ? newId : id);
          return { ...s, workItemLineItemIds: newWorkItemIds, lineItemIds: [...new Set(newWorkItemIds)].filter(Boolean) };
        }
        return s;
      })
    );
  }

  // ── Line item CRUD ────────────────────────────────────────────────────────
  function updateItem(id: string, field: keyof LineItemState, value: string) {
    setLineItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }
  function updateItemCustomValue(id: string, colId: string, value: string) {
    setLineItems((prev) => prev.map((item) =>
      item.id === id ? { ...item, customValues: { ...item.customValues, [colId]: value } } : item
    ));
  }
  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
    if (activeItemId === id) setActiveItemId(null);
  }
  function addBlankItem() { setLineItems((prev) => [...prev, blankItem()]); }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (!invoiceNumber.trim()) { setSaveError("Invoice number is required."); return; }
    if (!clientName.trim()) { setSaveError("Client name is required."); return; }
    setSaveError(""); setSaving(true);
    const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const savedItems = lineItems.map(({ id: _id, breakdown: _bd, priceBasis: _pb, ...rest }) => rest);

    if (mode === "new") {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoice_number: invoiceNumber, client_name: clientName,
          date_from: dateFrom || todayStr(), date_to: dateTo || todayStr(),
          invoice_date: invoiceDate, company_name: companyName || null,
          company_address: companyAddress || null, line_items: savedItems,
          total, notes: notes || null, status: "draft", column_config: columnConfig,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (data.id) { router.push(`/admin/invoices/${data.id}`); }
      else { setSaveError(data.error ?? "Failed to save. Please try again."); }
    } else {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoice_number: invoiceNumber, client_name: clientName,
          date_from: dateFrom || todayStr(), date_to: dateTo || todayStr(),
          invoice_date: invoiceDate, company_name: companyName || null,
          company_address: companyAddress || null, line_items: savedItems,
          total, notes: notes || null, column_config: columnConfig,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (data.ok) { router.push(`/admin/invoices/${invoiceId}`); }
      else { setSaveError(data.error ?? "Failed to save. Please try again."); }
    }
  }

  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const customCols = columnConfig.filter((c) => c.type === "custom");
  const hasPendingAny = linkedJobs.some((j) => j.pendingSubmissions.length > 0);

  if (loadingInvoice) {
    return <p className="text-gray-500 p-8">Loading invoice…</p>;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="-mx-4 -mt-8">
      {/* Mobile toggle */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white sticky top-0 z-20">
        {(["form", "preview"] as const).map((v) => (
          <button key={v} onClick={() => setMobileView(v)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${mobileView === v ? "text-navy-600 border-b-2 border-navy-600" : "text-gray-400"}`}>
            {v === "form" ? "Form" : "Preview"}
          </button>
        ))}
      </div>

      {/* Top split grid — Invoice Details + Columns | Preview */}
      <div className="grid lg:grid-cols-[45%_55%]">

        {/* ── LEFT: details + columns ──────────────────────────────────────── */}
        <div className={`${mobileView === "preview" ? "hidden lg:block" : "block"} px-4 pt-8 pb-4 space-y-4 bg-gray-50 lg:bg-transparent`}>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900">{mode === "new" ? "New Invoice" : "Edit Invoice"}</h1>
            {mode === "edit" && autoSaveStatus !== "idle" && (
              <span className={`text-xs font-medium transition-colors ${
                autoSaveStatus === "saving" ? "text-gray-400" :
                autoSaveStatus === "saved"  ? "text-green-500" :
                "text-red-400"
              }`}>
                {autoSaveStatus === "saving" ? "Saving…" :
                 autoSaveStatus === "saved"  ? "✓ Saved" :
                 "Auto-save failed"}
              </span>
            )}
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
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Auto-fills from linked job"
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

          {/* Invoice Columns */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-1">Invoice Columns</h2>
            <p className="text-xs text-gray-400 mb-4">Toggle which columns appear on the invoice, or add custom ones.</p>
            <div className="space-y-3 mb-4">
              {columnConfig.filter((c) => c.type !== "custom").map((col) => (
                <div key={col.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">{col.label}</span>
                  <Toggle on={col.visible} onChange={() => toggleColumn(col.id)} />
                </div>
              ))}
            </div>
            {customCols.length > 0 && (
              <div className="border-t border-gray-100 pt-3 mb-3 space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Custom columns</p>
                {customCols.map((col) => (
                  <div key={col.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{col.label}</span>
                    <button onClick={() => removeCustomColumn(col.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-0.5" title="Remove column">
                      <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {addingCol ? (
              <div className="flex gap-2 mt-2">
                <input autoFocus value={newColLabel} onChange={(e) => setNewColLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomColumn(); if (e.key === "Escape") { setAddingCol(false); setNewColLabel(""); } }}
                  placeholder="Column name (e.g. PO Number)"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
                <button onClick={addCustomColumn} className="bg-navy-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-navy-700">Add</button>
                <button onClick={() => { setAddingCol(false); setNewColLabel(""); }} className="text-gray-400 hover:text-gray-600 text-xs px-2">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddingCol(true)} className="text-sm text-navy-600 hover:text-navy-800 font-medium mt-1">+ Add custom column</button>
            )}
          </div>
        </div>

        {/* ── RIGHT: invoice preview (sticky) ──────────────────────────────── */}
        <div className={`${mobileView === "form" ? "hidden lg:block" : "block"} border-l border-gray-200 bg-gray-50 px-4 py-8`}
          style={{ position: "sticky", top: 72, alignSelf: "start", maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Live Preview
            <span className="normal-case font-normal ml-2 text-gray-300">· click any field to edit</span>
          </p>
          <InvoicePreview invoiceNumber={invoiceNumber} invoiceDate={invoiceDate} companyName={companyName}
            companyAddress={companyAddress} clientName={clientName} dateFrom={dateFrom} dateTo={dateTo}
            notes={notes} lineItems={lineItems} columns={columnConfig} activeItemId={activeItemId}
            onActivate={setActiveItemId} onUpdateItem={updateItem} onUpdateCustomValue={updateItemCustomValue} />
        </div>
      </div>

      {/* ── MIDDLE: linked jobs | added hour logs ────────────────────────── */}
      <div className={`${mobileView === "preview" ? "hidden lg:block" : "block"} grid lg:grid-cols-2 border-t border-gray-200`}>

        {/* Linked Jobs */}
        <div className="px-4 py-4 border-r border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Linked Jobs</h2>
            {hasPendingAny && (
              <button onClick={addAllSubmissions}
                className="text-xs font-semibold text-navy-600 hover:text-navy-800 border border-navy-200 rounded-lg px-2.5 py-1 hover:bg-navy-50 transition-colors">
                Add All
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">Link a job to see its hour log submissions. Add them individually or all at once.</p>

          {linkedJobs.length > 0 && (
            <div className="mb-3 space-y-3">
              {linkedJobs.map((job) => {
                const addedCount = lineItems.filter((i) => i.sourceJobId === job.eventId).length;
                return (
                  <div key={job.eventId} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{job.title}</p>
                        <p className="text-xs text-gray-400">
                          {job.client && `${job.client} · `}{job.date}
                          {addedCount > 0 && <span className="text-green-600 ml-1">· {addedCount} line{addedCount !== 1 ? "s" : ""} added</span>}
                        </p>
                      </div>
                      {job.pendingSubmissions.length > 0 && (
                        <button onClick={() => addAllSubmissionsForJob(job.eventId)}
                          className="shrink-0 text-xs font-semibold text-navy-600 hover:text-navy-800 transition-colors">
                          Add all
                        </button>
                      )}
                      <button onClick={() => unlinkJob(job.eventId)}
                        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors p-1" title="Remove job">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                        </svg>
                      </button>
                    </div>
                    {job.pendingSubmissions.length === 0 ? (
                      <p className="text-xs text-gray-400 italic px-4 py-3">All submissions added to invoice.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {job.pendingSubmissions.map((sub) => {
                          const subKey = `${job.eventId}-${sub.submissionId}`;
                          const isExpanded = expandedSubmissions.has(subKey);
                          return (
                            <div key={sub.submissionId} className="p-3">
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => setExpandedSubmissions((prev) => {
                                    const next = new Set(prev);
                                    next.has(subKey) ? next.delete(subKey) : next.add(subKey);
                                    return next;
                                  })}
                                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                                    <polyline points="3 2 7 5 3 8"/>
                                  </svg>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{sub.employee}</p>
                                    <p className="text-xs text-gray-400">{formatShortDate(sub.date)}</p>
                                  </div>
                                </button>
                                <button onClick={() => addSubmission(job.eventId, sub.submissionId)}
                                  className="shrink-0 text-xs font-semibold bg-navy-50 border border-navy-200 text-navy-600 hover:bg-navy-100 rounded-lg px-2.5 py-1 transition-colors">
                                  Add
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="mt-2 ml-4 space-y-1.5">
                                  {sub.workItems.map((wi, i) => (
                                    <div key={i} className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${wi.slug === "standard" ? "bg-navy-100 text-navy-700" : "bg-indigo-100 text-indigo-700"}`}>
                                        {wi.typeName}{wi.hours && ` · ${wi.hours}`}
                                      </span>
                                      {wi.description !== wi.typeName && (
                                        <span className="text-[11px] text-gray-500 truncate">{wi.description.replace(`${wi.typeName} – `, "")}</span>
                                      )}
                                    </div>
                                  ))}
                                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                    {sub.lineItems.map((li, i) => (
                                      <div key={i} className="flex items-center justify-between text-[11px]">
                                        <span className="text-gray-600 truncate flex-1 mr-2">{li.description}</span>
                                        <span className="text-gray-500 tabular-nums shrink-0">
                                          {li.hours}h
                                          {li.amount ? ` · $${Number(li.amount).toFixed(2)}` : ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div ref={searchRef} className="relative flex gap-2">
            <input value={jobSearch} onChange={(e) => setJobSearch(e.target.value)}
              placeholder="Search by job title or client…"
              onFocus={() => { if (jobResults.length > 0) setJobSearchOpen(true); }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
            <button type="button" onClick={() => setCalOpen(true)} title="Pick from calendar"
              className="shrink-0 border border-gray-300 rounded-lg px-2.5 py-2 text-gray-500 hover:text-navy-600 hover:border-navy-400 transition-colors">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="14" height="13" rx="2"/><line x1="3" y1="8" x2="17" y2="8"/>
                <line x1="7" y1="2" x2="7" y2="5"/><line x1="13" y1="2" x2="13" y2="5"/>
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
                        : <span className="text-xs text-navy-600 font-semibold">+ Link</span>}
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

          {ongoingJobs.length > 0 && (
            <div ref={ongoingRef} className="relative mt-2">
              <button
                type="button"
                onClick={() => setOngoingPickerOpen((o) => !o)}
                className="w-full flex items-center justify-between border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-navy-600 hover:border-navy-400 transition-colors"
              >
                <span>Link an ongoing job (adds every day logged against it)</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {ongoingPickerOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-56 overflow-y-auto">
                  {ongoingJobs.map((oj) => (
                    <button
                      key={oj.id}
                      type="button"
                      disabled={linkingOngoingId === oj.id}
                      onClick={() => linkOngoingJob(oj.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{oj.title}</p>
                        {oj.client && <p className="text-xs text-gray-500">{oj.client}</p>}
                      </div>
                      {linkingOngoingId === oj.id && <span className="text-xs text-gray-400">Linking…</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Added Hour Logs */}
        <div className="px-4 py-4">
          <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-3">Added Hour Logs</h2>
          {addedSubmissions.length === 0 ? (
            <p className="text-xs text-gray-400">Added submissions will appear here once you add them from Linked Jobs.</p>
          ) : (
            <div className="space-y-2">
              {addedSubmissions.map((sub) => {
                const anyNotInInvoice = sub.workItemLineItemIds.some((id) => !lineItems.some((li) => li.id === id));
                return (
                  <div key={sub.submissionId} className={`border rounded-lg p-3 transition-colors ${anyNotInInvoice ? "border-amber-200 bg-amber-50/40" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate">{sub.jobTitle}</p>
                        <p className="text-sm font-semibold text-gray-900">{sub.employee}</p>
                        <p className="text-xs text-gray-400">{formatShortDate(sub.date)}</p>
                      </div>
                      <button
                        onClick={() => removeAddedSubmission(sub.submissionId)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0 mt-0.5"
                        title="Remove from invoice"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                        </svg>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sub.workItems.map((wi, i) => {
                        const pillIn = lineItems.some((li) => li.id === sub.workItemLineItemIds[i]);
                        const label = `${wi.typeName}${wi.hours ? ` · ${wi.hours}` : ""}`;
                        if (pillIn) {
                          const colorClass = wi.slug === "standard"
                            ? "bg-navy-100 text-navy-700 hover:bg-red-100 hover:text-red-600"
                            : "bg-indigo-100 text-indigo-700 hover:bg-red-100 hover:text-red-600";
                          return (
                            <button key={i} onClick={() => removeWorkItem(sub.submissionId, i)}
                              title="Remove from invoice"
                              className={`group/pill flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${colorClass}`}>
                              {label}
                              <svg className="opacity-0 group-hover/pill:opacity-100 transition-opacity ml-0.5 shrink-0"
                                width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                              </svg>
                            </button>
                          );
                        }
                        return (
                          <button key={i} onClick={() => reAddWorkItem(sub.submissionId, i)}
                            title="Add back to invoice"
                            className="flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                            + {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FULL-WIDTH: line items + save ─────────────────────────────────── */}
      <div className={`${mobileView === "preview" ? "hidden lg:block" : "block"} px-4 py-4 space-y-4 border-t border-gray-200 bg-white`}>
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-3">Line Items</h2>
            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-400 mb-3">Link a job above or add a line manually.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {lineItems.map((item) => {
                  const isActive = activeItemId === item.id;
                  const isExpanded = expandedBreakdowns.has(item.id);
                  const hasBreakdown = (item.breakdown && item.breakdown.length > 1) || (item.priceBasis && item.priceBasis.length > 0);
                  return (
                    <div key={item.id}
                      className={`rounded-xl border transition-colors ${isActive ? "border-navy-300 bg-navy-50" : "border-gray-200 bg-white"}`}>
                      <div className="grid grid-cols-[1fr_auto] gap-3 p-3 sm:p-4">
                        <div className="space-y-2">
                          {item.sourceJobTitle && (
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{item.sourceJobTitle}</span>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                            <div>
                              <label className="text-[10px] text-gray-400">Hours</label>
                              <input type="number" min="0" step="0.25" value={item.hours}
                                onChange={(e) => updateItem(item.id, "hours", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">Amount ($)</label>
                              <input type="number" min="0" step="0.01" value={item.amount} placeholder="0.00"
                                onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400">Description</label>
                              <input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                            <div className="w-28">
                              <label className="text-[10px] text-gray-400">Rate</label>
                              <input value={item.rate ?? ""} onChange={(e) => updateItem(item.id, "rate", e.target.value)}
                                onFocus={() => setActiveItemId(item.id)} placeholder="e.g. $35/hr"
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                          </div>
                          {customCols.map((col) => (
                            <div key={col.id}>
                              <label className="text-[10px] text-gray-400">{col.label}</label>
                              <input value={item.customValues?.[col.id] ?? ""}
                                onChange={(e) => updateItemCustomValue(item.id, col.id, e.target.value)}
                                onFocus={() => setActiveItemId(item.id)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy-400" />
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeItem(item.id)} className="self-start mt-1 text-red-400 hover:text-red-600 p-1">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                          </svg>
                        </button>
                      </div>

                      {hasBreakdown && (
                        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                          <button onClick={() => setExpandedBreakdowns((prev) => {
                            const next = new Set(prev); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next;
                          })} className="flex items-center gap-1 text-[11px] text-navy-500 hover:text-navy-700 font-medium transition-colors">
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
                                  {item.priceBasis.map((line, i) => <p key={i} className="text-[11px] text-gray-600 font-mono">{line}</p>)}
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
            <button onClick={addBlankItem} className="text-sm text-navy-600 hover:text-navy-800 font-medium">+ Add line manually</button>
          </div>

          {/* Total + Save */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div className="text-lg font-bold text-gray-900">
              Total: <span className="text-navy-600">${total.toFixed(2)}</span>
            </div>
            <button onClick={save} disabled={saving}
              className="bg-navy-600 hover:bg-navy-700 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-2.5 text-sm">
              {saving ? "Saving…" : mode === "new" ? "Save as Draft" : "Save Changes"}
            </button>
          </div>
          {saveError && <p className="text-red-500 text-sm text-center">{saveError}</p>}
        </div>
      </div>

      {calOpen && (
        <JobCalendarModal linkedJobIds={new Set(linkedJobs.map((j) => j.eventId))} loadingJobId={loadingJobId}
          onLink={(job) => { linkJob({ id: job.id, title: job.title, client: job.client, date: job.date }); setCalOpen(false); }}
          onClose={() => setCalOpen(false)} />
      )}
    </div>
  );
}
