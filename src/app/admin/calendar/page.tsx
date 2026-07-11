"use client";

import { useEffect, useRef, useState } from "react";
import CrewBoard from "./components/CrewBoard";
import WorkloadView from "./components/WorkloadView";
import AvailabilityGrid from "./components/AvailabilityGrid";
import MyPlanView from "./components/MyPlanView";
import { ALL_TYPE_CONFIGS, PlanEvent, UnifiedEventType } from "./constants/eventTypes";
import ScheduleSidebar from "./components/ScheduleSidebar";
import PlanEventModal from "./components/PlanEventModal";

interface JobEvent {
  id: string;
  date: string;
  title: string;
  client: string;
  location: string;
  description: string;
  start_time: string;
  end_time: string;
  assigned_to: string;
  is_verified: boolean;
}

interface UnifiedEvent {
  id: string;
  source: "job" | "plan";
  type: UnifiedEventType;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  // job-only
  client?: string;
  location?: string;
  assigned_to?: string;
  is_verified?: boolean;
  // plan-only
  description?: string;
}

interface Worker {
  id: string;
  full_name: string;
  role: string;
  hourly_wage?: number | null;
}

interface BillableSubEntry {
  slug: string;
  customFields?: Record<string, string>;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

interface OldTypeSnapshot {
  client?: string;
  description?: string;
  customFields?: Record<string, string>;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
}

interface LinkedBillableEntry {
  client?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  manualHours?: number;
  customFields?: Record<string, string>;
  linkedEventId?: string;
  subEntries?: BillableSubEntry[];
  entryType?: string;
  _typeData?: Record<string, OldTypeSnapshot>;
}

interface DisplayItem {
  slug: string;
  hrs: string;
  client?: string;
  description?: string;
  fields?: [string, string][];
}

interface LinkedSubmission {
  id: string;
  employee_name: string;
  date: string;
  billable_entries: LinkedBillableEntry[];
}

type CalTab = "schedule" | "crew" | "availability" | "workload" | "plan";
type CalView = "month" | "week" | "day" | "list";

function getDisplayItems(entry: LinkedBillableEntry, generalHrs: string): DisplayItem[] {
  const items: DisplayItem[] = [];
  if (entry.subEntries != null) {
    if (entry.client || entry.description) {
      items.push({ slug: "standard", hrs: generalHrs, client: entry.client, description: entry.description });
    }
    for (const sub of entry.subEntries) {
      const subHrs = calcHrs(sub.startTime, sub.endTime, sub.manualHours);
      const fields = Object.entries(sub.customFields ?? {}).filter(([, v]) => v) as [string, string][];
      items.push({ slug: sub.slug, hrs: subHrs, fields });
    }
  } else {
    const activeSlug = entry.entryType ?? "standard";
    if (activeSlug === "standard") {
      if (entry.client || entry.description) {
        items.push({ slug: "standard", hrs: generalHrs, client: entry.client, description: entry.description });
      }
    } else {
      const fields = Object.entries(entry.customFields ?? {}).filter(([, v]) => v) as [string, string][];
      items.push({ slug: activeSlug, hrs: generalHrs, fields });
    }
    for (const [slug, data] of Object.entries(entry._typeData ?? {})) {
      const dataHrs = calcHrs(data.startTime, data.endTime, data.manualHours);
      if (slug === "standard") {
        if (data.client || data.description) {
          items.push({ slug: "standard", hrs: dataHrs, client: data.client, description: data.description });
        }
      } else {
        const fields = Object.entries(data.customFields ?? {}).filter(([, v]) => v) as [string, string][];
        if (fields.length > 0) items.push({ slug, hrs: dataHrs, fields });
      }
    }
  }
  return items;
}

function calcHrs(start?: string, end?: string, manual?: number): string {
  if (manual != null) return `${manual}h`;
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function calcHrsDecimal(start?: string, end?: string, manual?: number): number {
  if (manual != null) return manual;
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max((eh * 60 + em - (sh * 60 + sm)) / 60, 0);
}

function fmtDecimalHrs(h: number): string {
  if (h <= 0) return "";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours}h`;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function slugLabel(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtShortDate(d: string): string {
  const [y, mo, day] = d.split("-").map(Number);
  return new Date(y, mo - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDayDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function getMonthDays(offset: number): Date[] {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const endPad = (7 - lastOfMonth.getDay()) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startPad);
  const totalDays = startPad + lastOfMonth.getDate() + endPad;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function dayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

function generateRecurrenceDates(startDate: string, recurrence: string, until: string): string[] {
  const dates: string[] = [];
  const [y, m, d] = startDate.split("-").map(Number);
  const [uy, um, ud] = until.split("-").map(Number);
  const untilDate = new Date(uy, um - 1, ud);
  let current = new Date(y, m - 1, d);
  while (current <= untilDate && dates.length < 365) {
    dates.push(fmt(current));
    const next = new Date(current);
    if (recurrence === "daily") next.setDate(next.getDate() + 1);
    else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
    else if (recurrence === "biweekly") next.setDate(next.getDate() + 14);
    else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
    current = next;
  }
  return dates;
}

const EMPTY_FORM = {
  date: "",
  title: "",
  client: "",
  location: "",
  description: "",
  start_time: "",
  end_time: "",
  assigned_to: "",
  is_verified: true as boolean,
  recurrence: "" as "" | "daily" | "weekly" | "biweekly" | "monthly",
  repeat_until: "",
};

const START_HOUR = 6;
const END_HOUR = 19;
const HOUR_HEIGHT = 64;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const h = START_HOUR + i;
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
});

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function layoutEvents(evs: UnifiedEvent[]): { ev: UnifiedEvent; col: number; totalCols: number }[] {
  const sorted = [...evs].sort((a, b) => toDecimalHour(a.start_time) - toDecimalHour(b.start_time));
  const cols = new Array(sorted.length).fill(0);
  for (let i = 0; i < sorted.length; i++) {
    const s = toDecimalHour(sorted[i].start_time);
    const e = sorted[i].end_time ? toDecimalHour(sorted[i].end_time) : s + 1;
    const taken = new Set<number>();
    for (let j = 0; j < i; j++) {
      const sj = toDecimalHour(sorted[j].start_time);
      const ej = sorted[j].end_time ? toDecimalHour(sorted[j].end_time) : sj + 1;
      if (s < ej && e > sj) taken.add(cols[j]);
    }
    let c = 0;
    while (taken.has(c)) c++;
    cols[i] = c;
  }
  return sorted.map((ev, i) => {
    const s = toDecimalHour(ev.start_time);
    const e = ev.end_time ? toDecimalHour(ev.end_time) : s + 1;
    let maxCol = cols[i];
    for (let j = 0; j < sorted.length; j++) {
      const sj = toDecimalHour(sorted[j].start_time);
      const ej = sorted[j].end_time ? toDecimalHour(sorted[j].end_time) : sj + 1;
      if (s < ej && e > sj) maxCol = Math.max(maxCol, cols[j]);
    }
    return { ev, col: cols[i], totalCols: maxCol + 1 };
  });
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [year, month, day] = d.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function toDecimalHour(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function getEventStyle(type: string): { color: string; bg: string } {
  return ALL_TYPE_CONFIGS[type] ?? { color: "#3b82f6", bg: "#eff6ff" };
}

// SVG path data for type icons (12×12 viewport)
const TYPE_ICON_PATHS: Record<string, string> = {
  job:          "M2 7h20v14H2zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  "draft-job":  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  meeting:      "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  "site-visit": "M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  task:         "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  reminder:     "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  note:         "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",
};

function EventTypeIcon({ type, color }: { type: string; color: string }) {
  const paths = TYPE_ICON_PATHS[type]?.split(" M ").flatMap((p, i) => i === 0 ? [p] : ["M " + p]) ?? [];
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const CAL_TAB_LABELS: Record<CalTab, string> = {
  schedule: "Schedule",
  crew: "Crew Board",
  availability: "Availability",
  workload: "Workload",
  plan: "My Plan",
};

export default function AdminCalendar() {
  const [calTab, setCalTab] = useState<CalTab>("schedule");
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<JobEvent | null>(null);
  const [panelForm, setPanelForm] = useState(EMPTY_FORM);
  const [linkedLogs, setLinkedLogs] = useState<LinkedSubmission[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [calView, setCalView] = useState<CalView>("week");
  const [dayOffset, setDayOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "verified" | "unverified">("all");
  const [planEvents, setPlanEvents] = useState<PlanEvent[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(["job", "draft-job", "meeting", "site-visit", "task", "reminder", "note"])
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalType, setPlanModalType] = useState<string>("task");
  const [planModalDate, setPlanModalDate] = useState<string>("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const isDraggingRef = useRef(false);

  const weekDates = getWeekDates(weekOffset);
  const from = fmt(weekDates[0]);
  const to = fmt(weekDates[6]);
  const todayStr = fmt(new Date());
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const dayDate = getDayDate(dayOffset);
  const monthDays = getMonthDays(monthOffset);

  let fetchFrom: string, fetchTo: string;
  if (calView === "week" || calView === "list") {
    fetchFrom = from; fetchTo = to;
  } else if (calView === "day") {
    fetchFrom = fetchTo = fmt(dayDate);
  } else {
    fetchFrom = fmt(monthDays[0]);
    fetchTo = fmt(monthDays[monthDays.length - 1]);
  }

  const workerNames = workers.filter((w) => w.role === "worker").map((w) => w.full_name);
  const isPanelDirty = !!selectedEvent && JSON.stringify(panelForm) !== JSON.stringify(eventToForm(selectedEvent));

  const filteredJobEvents = events.filter((ev) => {
    if (filterEmployee && !ev.assigned_to?.toLowerCase().includes(filterEmployee.toLowerCase())) return false;
    if (filterStatus === "verified" && ev.is_verified === false) return false;
    if (filterStatus === "unverified" && ev.is_verified !== false) return false;
    return true;
  });

  const unifiedEvents: UnifiedEvent[] = [
    ...filteredJobEvents.map((ev): UnifiedEvent => ({
      id: ev.id,
      source: "job",
      type: ev.is_verified === false ? "draft-job" : "job",
      date: ev.date,
      title: ev.title,
      start_time: ev.start_time ?? "",
      end_time: ev.end_time ?? "",
      client: ev.client,
      location: ev.location,
      assigned_to: ev.assigned_to,
      is_verified: ev.is_verified,
    })),
    ...planEvents.map((ev): UnifiedEvent => ({
      id: ev.id,
      source: "plan",
      type: ev.event_type,
      date: ev.date,
      title: ev.title,
      start_time: ev.start_time ?? "",
      end_time: ev.end_time ?? "",
      description: ev.description,
    })),
  ].filter((ev) => visibleTypes.has(ev.type));

  function goBack() {
    if (calView === "week" || calView === "list") setWeekOffset((o) => o - 1);
    else if (calView === "day") setDayOffset((o) => o - 1);
    else setMonthOffset((o) => o - 1);
  }

  function goForward() {
    if (calView === "week" || calView === "list") setWeekOffset((o) => o + 1);
    else if (calView === "day") setDayOffset((o) => o + 1);
    else setMonthOffset((o) => o + 1);
  }

  function goToday() {
    setWeekOffset(0);
    setDayOffset(0);
    setMonthOffset(0);
  }

  function handleQuickAdd(type: string) {
    if (type === "job") {
      openNew(calView === "day" ? fmt(dayDate) : "");
    } else {
      setPlanModalType(type);
      setPlanModalDate(calView === "day" ? fmt(dayDate) : fmt(new Date()));
      setPlanModalOpen(true);
    }
  }

  function handleToggleType(type: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const showTodayBtn = weekOffset !== 0 || dayOffset !== 0 || monthOffset !== 0;

  function getNavLabel(): string {
    if (calView === "month") {
      const now = new Date();
      const t = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      return `${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
    }
    if (calView === "day") {
      if (dayOffset === 0) return "Today";
      if (dayOffset === -1) return "Yesterday";
      if (dayOffset === 1) return "Tomorrow";
      return dayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    return `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`;
  }

  useEffect(() => {
    if (calTab !== "schedule") return;
    fetch(`/api/events?from=${fetchFrom}&to=${fetchTo}`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []));
  }, [fetchFrom, fetchTo, calTab]);

  useEffect(() => {
    if (calTab !== "schedule") return;
    fetch(`/api/admin/plan-events?from=${fetchFrom}&to=${fetchTo}`, { credentials: "include" })
      .then((r) => { if (!r.ok) return []; return r.json(); })
      .then((data) => setPlanEvents(Array.isArray(data) ? data : []));
  }, [fetchFrom, fetchTo, calTab]);

  useEffect(() => {
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setWorkers(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    setExpandedLogs([]);
    if (!selectedEvent) { setLinkedLogs([]); return; }
    setLoadingLogs(true);
    fetch(`/api/submissions?eventId=${selectedEvent.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setLinkedLogs(Array.isArray(data) ? data : []); setLoadingLogs(false); })
      .catch(() => setLoadingLogs(false));
  }, [selectedEvent?.id]);

  function toggleLog(id: string) {
    setExpandedLogs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function openNew(date = "", startTime = "", assignedTo = "") {
    setForm({ ...EMPTY_FORM, date, start_time: startTime, assigned_to: assignedTo, is_verified: true });
    setEditId(null);
    setShowForm(true);
  }

  function eventToForm(ev: JobEvent) {
    return {
      ...EMPTY_FORM,
      date: ev.date,
      title: ev.title,
      client: ev.client ?? "",
      location: ev.location ?? "",
      description: ev.description ?? "",
      start_time: ev.start_time ?? "",
      end_time: ev.end_time ?? "",
      assigned_to: ev.assigned_to ?? "",
      is_verified: ev.is_verified !== false,
    };
  }

  async function selectEvent(ev: UnifiedEvent) {
    if (ev.source !== "job") return;
    const jobEv = ev as unknown as JobEvent;
    if (selectedEvent && selectedEvent.id !== ev.id && isPanelDirty) {
      await handleSavePanel(false);
    }
    setSelectedEvent(jobEv);
    setPanelForm(eventToForm(jobEv));
  }

  async function closePanel() {
    if (selectedEvent && isPanelDirty) {
      await handleSavePanel(false);
    }
    setSelectedEvent(null);
  }

  function handleGridClick(dateStr: string, e: React.MouseEvent<HTMLDivElement>) {
    if (isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const decimalHour = relY / HOUR_HEIGHT + START_HOUR;
    const hour = Math.floor(decimalHour);
    const rawMin = Math.round(((decimalHour - hour) * 60) / 15) * 15;
    const h = rawMin >= 60 ? hour + 1 : hour;
    const m = rawMin >= 60 ? 0 : rawMin;
    openNew(dateStr, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  function handleDragStart(e: React.DragEvent, ev: UnifiedEvent) {
    isDraggingRef.current = true;
    e.dataTransfer.setData("eventId", ev.id);
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(dateStr: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const eventId = e.dataTransfer.getData("eventId");
    if (!eventId) { isDraggingRef.current = false; return; }

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const decimalHour = Math.max(START_HOUR, Math.min(relY / HOUR_HEIGHT + START_HOUR, END_HOUR - 0.5));
    const hour = Math.floor(decimalHour);
    const rawMin = Math.round(((decimalHour - hour) * 60) / 15) * 15;
    const h = rawMin >= 60 ? hour + 1 : hour;
    const m = rawMin >= 60 ? 0 : rawMin;
    const newStartTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const ev = events.find((e) => e.id === eventId);
    if (!ev) { isDraggingRef.current = false; return; }

    let newEndTime = ev.end_time;
    if (ev.start_time && ev.end_time) {
      const duration = toDecimalHour(ev.end_time) - toDecimalHour(ev.start_time);
      const newEndDecimal = toDecimalHour(newStartTime) + duration;
      const newEndH = Math.floor(newEndDecimal);
      const newEndM = Math.round((newEndDecimal - newEndH) * 60);
      newEndTime = `${String(Math.min(newEndH, 23)).padStart(2, "0")}:${String(Math.min(newEndM, 59)).padStart(2, "0")}`;
    }

    setEvents((prev) => prev.map((e) =>
      e.id === eventId ? { ...e, date: dateStr, start_time: newStartTime, end_time: newEndTime ?? e.end_time } : e
    ));

    await fetch("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: eventId, date: dateStr, start_time: newStartTime, end_time: newEndTime }),
    });

    setTimeout(() => { isDraggingRef.current = false; }, 100);
  }

  async function handleSave() {
    if (!form.title || !form.date) return;
    setSaving(true);

    if (!editId && form.recurrence && form.repeat_until) {
      const dates = generateRecurrenceDates(form.date, form.recurrence, form.repeat_until);
      const { recurrence: _r, repeat_until: _u, ...basePayload } = form;
      for (const d of dates) {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...basePayload, date: d }),
        });
      }
    } else {
      const { recurrence: _r, repeat_until: _u, ...payload } = form;
      const method = editId ? "PUT" : "POST";
      const body = editId ? { id: editId, ...payload } : payload;
      await fetch("/api/events", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
    }

    const res = await fetch(`/api/events?from=${fetchFrom}&to=${fetchTo}`);
    setEvents(await res.json());
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job?")) return;
    await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvent(null);
  }

  async function handleSavePanel(markVerified = false) {
    if (!selectedEvent) return;
    setSaving(true);
    const { recurrence: _r, repeat_until: _u, ...payload } = panelForm;
    const body = { id: selectedEvent.id, ...payload, ...(markVerified ? { is_verified: true } : {}) };
    await fetch("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const res = await fetch(`/api/events?from=${fetchFrom}&to=${fetchTo}`);
    const data = await res.json();
    const list: JobEvent[] = Array.isArray(data) ? data : [];
    setEvents(list);
    const fresh = list.find((e) => e.id === selectedEvent.id) ?? null;
    setSelectedEvent(fresh);
    if (fresh) setPanelForm(eventToForm(fresh));
    setSaving(false);
  }

  function handleVoiceToggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    setTranscript("");
    setListening(true);

    recognition.onresult = (event: any) => {
      finalTranscript = Array.from(event.results as any[])
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(finalTranscript);
    };

    recognition.onend = async () => {
      setListening(false);
      if (!finalTranscript.trim()) { setTranscript(""); return; }
      setParsing(true);
      try {
        const res = await fetch("/api/admin/parse-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: finalTranscript }),
        });
        const parsed = await res.json();
        if (parsed.error) throw new Error(parsed.error);
        setForm({
          ...EMPTY_FORM,
          date: parsed.date ?? "",
          title: parsed.title ?? "",
          client: parsed.client ?? "",
          location: parsed.location ?? "",
          description: parsed.description ?? "",
          start_time: parsed.start_time ?? "",
          end_time: parsed.end_time ?? "",
          assigned_to: parsed.assigned_to ?? "",
          is_verified: false,
        });
        setEditId(null);
        setShowForm(true);
      } catch (err) {
        alert(`Failed to parse voice input: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setParsing(false);
        setTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      setParsing(false);
      setTranscript("");
      const err = event.error;
      if (err === "not-allowed") {
        alert("Microphone access was denied. Click the lock/camera icon in your browser's address bar and allow microphone access, then try again.");
      } else if (err === "no-speech") {
        alert("No speech was detected. Please try again and speak clearly.");
      } else if (err === "audio-capture") {
        alert("No microphone found. Please connect a microphone and try again.");
      } else {
        alert(`Voice error: ${err}. Please try again.`);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setListening(false);
      alert(`Could not start voice input: ${e}`);
    }
  }

  function renderTimeGrid(dates: Date[]) {
    return (
      <div className={`overflow-y-auto ${selectedEvent ? "max-h-60 md:max-h-[520px]" : "max-h-[520px]"}`}>
        <div className="flex" style={{ height: totalHeight }}>
          <div className="relative flex-shrink-0" style={{ width: 56 }}>
            {HOUR_LABELS.map((label, i) => (
              <div key={i} className="absolute right-0 pr-2 flex items-start" style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                <span className="text-xs text-gray-400 mt-1 leading-none">{label}</span>
              </div>
            ))}
          </div>
          {dates.map((date) => {
            const dateStr = fmt(date);
            const dayEvents = unifiedEvents.filter((e) => e.date === dateStr && e.start_time);
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={`flex-1 relative border-l border-gray-100 cursor-crosshair ${isToday ? "bg-navy-50/20" : ""}`}
                style={{ height: totalHeight }}
                onClick={(e) => handleGridClick(dateStr, e)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => handleDrop(dateStr, e)}
              >
                {HOUR_LABELS.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {layoutEvents(dayEvents).map(({ ev, col, totalCols }) => {
                  const startH = toDecimalHour(ev.start_time);
                  const endH = ev.end_time ? toDecimalHour(ev.end_time) : startH + 1;
                  const clampedStart = Math.max(startH, START_HOUR);
                  const clampedEnd = Math.min(endH, END_HOUR);
                  if (clampedEnd <= clampedStart) return null;
                  const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
                  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT - 4, 22);
                  const isSelected = selectedEvent?.id === ev.id;
                  const leftPct = (col / totalCols) * 100;
                  const widthPct = (1 / totalCols) * 100;
                  const { color, bg } = getEventStyle(ev.type);
                  return (
                    <div
                      key={ev.id}
                      draggable={ev.source === "job"}
                      className={`absolute rounded-xl px-2 py-1.5 overflow-hidden z-10 transition-all border-l-4 ${ev.source === "job" ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${isSelected ? "ring-2 ring-white ring-offset-1 brightness-90" : "hover:brightness-95"}`}
                      style={{
                        top: top + 2, height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: bg,
                        borderLeftColor: color,
                      }}
                      onDragStart={ev.source === "job" ? (e) => { e.stopPropagation(); handleDragStart(e, ev); } : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isDraggingRef.current && ev.source === "job") {
                          const original = events.find((j) => j.id === ev.id);
                          if (original) selectEvent(ev);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <EventTypeIcon type={ev.type} color={color} />
                        <p className="text-xs font-bold leading-tight truncate" style={{ color }}>{ev.title}</p>
                      </div>
                      {ev.client && height > 38 && (
                        <p className="text-xs truncate" style={{ color, opacity: 0.7 }}>{ev.client}</p>
                      )}
                      {height > 54 && ev.start_time && (
                        <p className="text-xs" style={{ color, opacity: 0.6 }}>
                          {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                        </p>
                      )}
                      {ev.type === "draft-job" && height > 30 && (
                        <p className="text-[10px] font-medium mt-0.5" style={{ color, opacity: 0.7 }}>Draft</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderListView() {
    const dateGroups: Record<string, UnifiedEvent[]> = {};
    for (const ev of unifiedEvents) {
      if (!dateGroups[ev.date]) dateGroups[ev.date] = [];
      dateGroups[ev.date].push(ev);
    }
    const sortedDates = Object.keys(dateGroups).sort();

    if (sortedDates.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">No jobs scheduled for this period.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sortedDates.map((dateStr) => (
          <div key={dateStr} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{formatDate(dateStr)}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {dateGroups[dateStr]
                .sort((a, b) => toDecimalHour(a.start_time) - toDecimalHour(b.start_time))
                .map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        if (ev.source !== "job") return;
                        const original = events.find((j) => j.id === ev.id);
                        if (original) isSelected ? closePanel() : selectEvent(ev);
                      }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${ev.source === "job" ? "cursor-pointer" : "cursor-default"} ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getEventStyle(ev.type).color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                          {ev.type === "draft-job" && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Draft</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {ev.start_time && (
                            <span className="text-xs text-gray-400">
                              {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                            </span>
                          )}
                          {ev.source === "plan" ? (
                            <span className="text-xs text-gray-400 capitalize">{ALL_TYPE_CONFIGS[ev.type]?.label}</span>
                          ) : (
                            <>
                              {ev.client && <span className="text-xs text-gray-400">· {ev.client}</span>}
                              {ev.assigned_to && <span className="text-xs text-gray-400">· {ev.assigned_to}</span>}
                            </>
                          )}
                        </div>
                      </div>
                      {ev.location && (
                        <span className="text-xs text-gray-400 shrink-0 hidden sm:block truncate max-w-[120px]">{ev.location}</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderDetailsPanel() {
    if (!selectedEvent) return null;
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
        {selectedEvent.is_verified === false && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs font-semibold text-amber-700">Unverified AI draft — review details before confirming</p>
          </div>
        )}

        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Job Details</p>
              {saving && <span className="text-xs text-gray-400">Saving…</span>}
            </div>
            <input
              type="text"
              value={panelForm.title}
              onChange={(e) => setPanelForm({ ...panelForm, title: e.target.value })}
              placeholder="Job title"
              className="w-full text-lg font-bold text-gray-900 leading-snug border-0 p-0 focus:outline-none focus:ring-0 bg-transparent"
            />
          </div>
          <button
            onClick={closePanel}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex-shrink-0 mt-0.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Date</label>
            <input
              type="date"
              value={panelForm.date}
              onChange={(e) => setPanelForm({ ...panelForm, date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Start time</label>
              <input
                type="time"
                value={panelForm.start_time}
                onChange={(e) => setPanelForm({ ...panelForm, start_time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">End time</label>
              <input
                type="time"
                value={panelForm.end_time}
                onChange={(e) => setPanelForm({ ...panelForm, end_time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Client</label>
            <input
              type="text"
              value={panelForm.client}
              onChange={(e) => setPanelForm({ ...panelForm, client: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Location</label>
            <input
              type="text"
              value={panelForm.location}
              onChange={(e) => setPanelForm({ ...panelForm, location: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Assigned to</label>
            <input
              type="text"
              placeholder="Employee name(s)"
              value={panelForm.assigned_to}
              list="worker-names-list-panel"
              onChange={(e) => setPanelForm({ ...panelForm, assigned_to: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
            <datalist id="worker-names-list-panel">
              {workerNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              rows={3}
              value={panelForm.description}
              onChange={(e) => setPanelForm({ ...panelForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            {(() => {
              const totalDecimal = linkedLogs.reduce((sum, log) => {
                const e = log.billable_entries.find((e) => e.linkedEventId === selectedEvent.id);
                return sum + calcHrsDecimal(e?.startTime, e?.endTime, e?.manualHours);
              }, 0);
              const totalStr = fmtDecimalHrs(totalDecimal);
              return (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Linked Hour Logs</p>
                  {!loadingLogs && totalStr && (
                    <span className="text-xs font-semibold text-navy-700 bg-navy-50 px-2 py-0.5 rounded-full">
                      {totalStr} total
                    </span>
                  )}
                </div>
              );
            })()}
            {loadingLogs ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : linkedLogs.length === 0 ? (
              <p className="text-xs text-gray-400">No employee logs linked to this job yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedLogs.map((log) => {
                  const entry = log.billable_entries.find((e) => e.linkedEventId === selectedEvent.id);
                  if (!entry) return null;
                  const hrs = calcHrs(entry.startTime, entry.endTime, entry.manualHours);
                  const items = getDisplayItems(entry, hrs);
                  const isExpanded = expandedLogs.includes(log.id);
                  const hasDetails = items.length > 0;
                  return (
                    <div key={log.id} className="bg-gray-50 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => hasDetails && toggleLog(log.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${hasDetails ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 truncate">{log.employee_name}</span>
                          <span className="text-xs text-gray-400 shrink-0">{fmtShortDate(log.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hrs && <span className="text-xs font-semibold text-navy-600">{hrs}</span>}
                          {hasDetails && <span className="text-gray-400 text-[10px]">{isExpanded ? "▲" : "▼"}</span>}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 space-y-1.5 border-t border-gray-200">
                          {items.map((item, ii) => (
                            <div key={ii} className="flex items-start gap-2">
                              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${item.slug === "standard" ? "bg-navy-100 text-navy-700" : "bg-indigo-100 text-indigo-700"}`}>
                                {item.slug === "standard" ? "General" : slugLabel(item.slug)}
                                {item.hrs ? ` · ${item.hrs}` : ""}
                              </span>
                              <span className="text-xs text-gray-600">
                                {item.slug === "standard"
                                  ? [item.client, item.description].filter(Boolean).join(" — ")
                                  : (item.fields ?? []).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          {selectedEvent.is_verified === false && (
            <button
              onClick={() => handleSavePanel(true)}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              Verify
            </button>
          )}
          <button
            onClick={() => handleDelete(selectedEvent.id)}
            className={`border border-red-200 text-red-500 hover:bg-red-50 rounded-xl py-2.5 text-sm font-semibold transition-colors ${selectedEvent.is_verified === false ? "px-4" : "flex-1"}`}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main section tab bar */}
      <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
        {(["schedule", "crew", "availability", "workload", "plan"] as CalTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setCalTab(tab); closePanel(); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
              calTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="hidden sm:inline">{CAL_TAB_LABELS[tab]}</span>
            <span className="sm:hidden">{tab === "crew" ? "Crew" : tab === "availability" ? "Avail." : tab === "plan" ? "Plan" : CAL_TAB_LABELS[tab]}</span>
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {calTab === "schedule" && (
        <div>
          <div className="mb-3 space-y-2">
            {/* Nav + action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={goBack}
                  className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
                >‹</button>
                <h1 className="text-xl font-bold text-gray-900">{getNavLabel()}</h1>
                <button
                  onClick={goForward}
                  className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
                >›</button>
                {showTodayBtn && (
                  <button onClick={goToday} className="text-sm font-semibold text-navy-600 underline">
                    Today
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVoiceToggle}
                  disabled={parsing}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    listening
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : parsing
                      ? "border border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  {listening ? "Stop" : parsing ? "Parsing…" : "Voice"}
                </button>
                <button
                  onClick={() => openNew(calView === "day" ? fmt(dayDate) : "")}
                  className="bg-navy-600 hover:bg-navy-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
                >
                  + Add Job
                </button>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {(["month", "week", "day", "list"] as CalView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    calView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

          </div>

          {/* Voice status bar */}
          {(listening || parsing) && (
            <div className="mb-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${listening ? "bg-red-500 animate-pulse" : "bg-navy-500 animate-pulse"}`} />
              <p className="text-sm text-gray-600 flex-1 italic truncate">
                {parsing ? "Parsing with AI…" : transcript ? `"${transcript}"` : "Listening… speak now"}
              </p>
            </div>
          )}

          {/* Sidebar + Calendar + Details */}
          <div className="flex gap-3 items-start">
            <ScheduleSidebar
              visibleTypes={visibleTypes}
              onToggleType={handleToggleType}
              filterEmployee={filterEmployee}
              onEmployeeFilterChange={setFilterEmployee}
              filterStatus={filterStatus}
              onStatusFilterChange={setFilterStatus}
              workerNames={workerNames}
              onQuickAdd={handleQuickAdd}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            />
            <div className="flex-1 min-w-0">
              {/* Calendar + Details split layout */}
              <div className={`flex flex-col ${selectedEvent ? "md:flex-row md:gap-4 md:items-start" : ""}`}>
                <div className={selectedEvent ? "md:w-1/2" : ""}>

              {/* MONTH VIEW */}
              {calView === "month" && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {DAY_NAMES.map((d) => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {(() => {
                      const displayedMonth = new Date(
                        new Date().getFullYear(), new Date().getMonth() + monthOffset, 1
                      ).getMonth();
                      return monthDays.map((date, idx) => {
                        const dateStr = fmt(date);
                        const isCurrentMonth = date.getMonth() === displayedMonth;
                        const isToday = dateStr === todayStr;
                        const dayEvents = unifiedEvents.filter((e) => e.date === dateStr);
                        return (
                          <div
                            key={dateStr}
                            onClick={() => { setDayOffset(dayDiff(date, new Date())); setCalView("day"); }}
                            className={`min-h-[72px] p-1 border-t border-gray-100 cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors ${
                              !isCurrentMonth ? "bg-gray-50/60" : ""
                            } ${idx % 7 !== 6 ? "border-r border-gray-100" : ""}`}
                          >
                            <div className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full mb-1 ${
                              isToday ? "bg-navy-600 text-white" : isCurrentMonth ? "text-gray-800" : "text-gray-300"
                            }`}>
                              {date.getDate()}
                            </div>
                            {dayEvents.slice(0, 2).map((ev) => {
                              const { color, bg } = getEventStyle(ev.type);
                              return (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (ev.source === "job") {
                                      const original = events.find((j) => j.id === ev.id);
                                      if (original) selectEvent(ev);
                                    }
                                  }}
                                  className="flex items-center gap-0.5 text-[9px] leading-tight px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer"
                                  style={{ backgroundColor: bg, borderLeft: `2px solid ${color}` }}
                                >
                                  <span className="truncate font-medium" style={{ color }}>{ev.title}</span>
                                </div>
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-[9px] text-gray-400 px-0.5">+{dayEvents.length - 2}</div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* WEEK VIEW */}
              {calView === "week" && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: 640 }}>
                      <div className="flex border-b border-gray-200" style={{ paddingLeft: 56 }}>
                        {weekDates.map((date, i) => {
                          const dateStr = fmt(date);
                          const isToday = dateStr === todayStr;
                          return (
                            <div key={dateStr} className={`flex-1 py-3 text-center border-l border-gray-100 ${isToday ? "bg-navy-50" : ""}`}>
                              <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? "text-navy-500" : "text-gray-400"}`}>
                                {DAY_NAMES[i]}
                              </div>
                              <div className={`text-2xl font-extrabold leading-tight mt-0.5 ${isToday ? "text-navy-600" : "text-gray-800"}`}>
                                {date.getDate()}
                              </div>
                              <div className={`text-xs mt-0.5 ${isToday ? "text-navy-400" : "text-gray-400"}`}>
                                {MONTHS[date.getMonth()]}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {renderTimeGrid(weekDates)}
                    </div>
                  </div>
                </div>
              )}

              {/* DAY VIEW */}
              {calView === "day" && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {(() => {
                    const dateStr = fmt(dayDate);
                    const isToday = dateStr === todayStr;
                    return (
                      <>
                        <div className={`py-3 text-center border-b border-gray-200 ${isToday ? "bg-navy-50" : ""}`}>
                          <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? "text-navy-500" : "text-gray-400"}`}>
                            {dayDate.toLocaleDateString("en-US", { weekday: "long" })}
                          </div>
                          <div className={`text-2xl font-extrabold leading-tight mt-0.5 ${isToday ? "text-navy-600" : "text-gray-800"}`}>
                            {dayDate.getDate()}
                          </div>
                          <div className={`text-xs mt-0.5 ${isToday ? "text-navy-400" : "text-gray-400"}`}>
                            {MONTHS[dayDate.getMonth()]} {dayDate.getFullYear()}
                          </div>
                        </div>
                        {renderTimeGrid([dayDate])}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* LIST VIEW */}
              {calView === "list" && renderListView()}
            </div>

                {/* Details panel (side panel on schedule tab) */}
                {selectedEvent && (
                  <div className="mt-4 md:mt-0 md:w-1/2">
                    {renderDetailsPanel()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREW BOARD TAB ── */}
      {calTab === "crew" && (
        <CrewBoard
          onAddJob={(date, assignedTo) => openNew(date, "", assignedTo)}
          onSelectEvent={(ev) => {
            const jobEv = ev as JobEvent;
            const unified: UnifiedEvent = {
              id: jobEv.id,
              source: "job",
              type: jobEv.is_verified === false ? "draft-job" : "job",
              date: jobEv.date,
              title: jobEv.title,
              start_time: jobEv.start_time ?? "",
              end_time: jobEv.end_time ?? "",
              client: jobEv.client,
              location: jobEv.location,
              assigned_to: jobEv.assigned_to,
              is_verified: jobEv.is_verified,
            };
            selectEvent(unified);
          }}
        />
      )}

      {/* ── AVAILABILITY TAB ── */}
      {calTab === "availability" && <AvailabilityGrid />}

      {/* ── WORKLOAD TAB ── */}
      {calTab === "workload" && <WorkloadView />}

      {/* ── MY PLAN TAB ── */}
      {calTab === "plan" && <MyPlanView />}

      {/* Details modal for non-schedule tabs */}
      {selectedEvent && calTab !== "schedule" && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-0 sm:p-4"
          onClick={closePanel}
        >
          <div
            className="w-full sm:max-w-md max-h-[85vh] overflow-auto rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {renderDetailsPanel()}
          </div>
        </div>
      )}

      {/* Plan event quick-add modal (for Schedule tab Quick Add) */}
      <PlanEventModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onSave={(saved) => {
          setPlanEvents((prev) => [...prev, saved]);
          setPlanModalOpen(false);
        }}
        initialType={planModalType as import("./constants/eventTypes").EventType}
        initialDate={planModalDate}
      />

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Job" : "Add Job"}</h2>

            {!form.is_verified && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs font-semibold text-amber-700">AI draft — review all fields before saving</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Job title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
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
                <label className="block text-xs text-gray-500 mb-1">Start time</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End time</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Assigned to</label>
                <input
                  type="text"
                  placeholder="Employee name(s)"
                  value={form.assigned_to}
                  list="worker-names-list"
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
                <datalist id="worker-names-list">
                  {workerNames.map((name) => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none" />
              </div>

              {/* Recurring options (new jobs only) */}
              {!editId && (
                <>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Repeats</label>
                    <select
                      value={form.recurrence}
                      onChange={(e) => setForm({ ...form, recurrence: e.target.value as typeof form.recurrence })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 bg-white"
                    >
                      <option value="">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {form.recurrence && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Repeat until *</label>
                      <input
                        type="date"
                        value={form.repeat_until}
                        min={form.date}
                        onChange={(e) => setForm({ ...form, repeat_until: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                      />
                      {form.date && form.repeat_until && form.recurrence && (
                        <p className="text-xs text-navy-600 mt-1 font-medium">
                          Creates {generateRecurrenceDates(form.date, form.recurrence, form.repeat_until).length} job{generateRecurrenceDates(form.date, form.recurrence, form.repeat_until).length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.date || (!!form.recurrence && !form.repeat_until)}
                className="flex-1 bg-navy-600 hover:bg-navy-700 disabled:bg-navy-400 text-white rounded-xl py-2.5 text-sm font-bold"
              >
                {saving ? "Saving…" : form.recurrence && form.repeat_until
                  ? `Create ${generateRecurrenceDates(form.date || "2000-01-01", form.recurrence, form.repeat_until).length} Jobs`
                  : form.is_verified ? "Save" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
