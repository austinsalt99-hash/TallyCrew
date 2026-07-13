# Mobile UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TallyCrew admin side fully usable on mobile (390px screens) without changing any desktop layout or behaviour.

**Architecture:** Tailwind's `md:` breakpoint (768px) is the architectural boundary — unprefixed classes set the mobile layout, `md:` classes lock in the desktop layout and are never changed. The CrewBoard's native HTML5 drag-and-drop is replaced with `@dnd-kit/core` which handles both mouse and touch through the same API. All other pages get targeted responsive class additions.

**Tech Stack:** Next.js 15, Tailwind CSS, TypeScript, `@dnd-kit/core`, `@dnd-kit/utilities`

## Global Constraints

- Desktop layout at ≥768px (`md:` breakpoint) must be pixel-identical before and after every task
- All interactive elements must have ≥44px touch target height on mobile
- No new routes, no JS-based breakpoint detection, no user-agent sniffing
- TypeScript: run `npx tsc --noEmit` after each task — zero new errors allowed
- Lint: run `npm run lint` after each task — zero new errors allowed
- The `.next` cache corrupts under OneDrive sync; if you get `ENOENT` errors on dev server restart, run `rm -rf .next && npm run dev`

---

### Task 1: Install @dnd-kit packages

**Files:**
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `@dnd-kit/core` and `@dnd-kit/utilities` available for import in Task 2

- [ ] **Step 1: Install the packages**

```bash
cd "TallyCrew code" && npm install @dnd-kit/core @dnd-kit/utilities
```

Expected output: `added N packages` with no peer-dep warnings.

- [ ] **Step 2: Verify packages appear in package.json**

```bash
grep "@dnd-kit" "TallyCrew code/package.json"
```

Expected: two lines containing `@dnd-kit/core` and `@dnd-kit/utilities` with version numbers.

- [ ] **Step 3: Type-check to confirm no TS issues from new packages**

```bash
cd "TallyCrew code" && npx tsc --noEmit 2>&1 | tail -5
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
cd "TallyCrew code" && git add package.json package-lock.json && git commit -m "feat: install @dnd-kit/core and @dnd-kit/utilities for touch drag support"
```

---

### Task 2: Migrate CrewBoard drag-and-drop to @dnd-kit

**Files:**
- Modify: `src/app/admin/calendar/components/CrewBoard.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/core` — `DndContext`, `DragOverlay`, `MouseSensor`, `TouchSensor`, `useSensor`, `useSensors`, `useDraggable`, `useDroppable`, `DragEndEvent`, `DragStartEvent`
- Produces: drag-and-drop that works on both mouse (desktop) and touch (mobile); API write still calls `PUT /api/events` with `{ id, date, assigned_to }`

**Background:** The current file uses native HTML5 `draggable`/`dataTransfer` events which don't fire on touch screens. The `renderChip` and `renderCell` render functions need to become proper React components so they can use hooks (`useDraggable`, `useDroppable`). The save logic in `handleDrop` is preserved verbatim in `handleDragEnd`.

- [ ] **Step 1: Replace the entire file**

The full replacement is below. Paste this as the new content of `src/app/admin/calendar/components/CrewBoard.tsx`:

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

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

interface Worker {
  id: string;
  full_name: string;
  role: string;
}

interface CrewBoardProps {
  onAddJob: (date: string, assignedTo: string) => void;
  onSelectEvent: (ev: JobEvent) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COMPACT_START = 6;
const COMPACT_END = 19;
const COMPACT_HOUR_HEIGHT = 36;
const COMPACT_HEADER_HEIGHT = 28;
const EXPANDED_HEIGHT = COMPACT_HEADER_HEIGHT + (COMPACT_END - COMPACT_START) * COMPACT_HOUR_HEIGHT;

const HOUR_LABELS = Array.from({ length: COMPACT_END - COMPACT_START }, (_, i) => {
  const h = COMPACT_START + i;
  if (h === 12) return "12P";
  return h < 12 ? `${h}A` : `${h - 12}P`;
});

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function toDecimalHour(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function isAssignedTo(ev: JobEvent, name: string): boolean {
  if (!ev.assigned_to) return false;
  return ev.assigned_to.toLowerCase().includes(name.toLowerCase());
}

function layoutEvents(evs: JobEvent[]): { ev: JobEvent; col: number; totalCols: number }[] {
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

function getOverlappingIds(evs: JobEvent[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < evs.length; i++) {
    if (!evs[i].start_time) continue;
    for (let j = i + 1; j < evs.length; j++) {
      if (!evs[j].start_time) continue;
      const s1 = toDecimalHour(evs[i].start_time);
      const e1 = evs[i].end_time ? toDecimalHour(evs[i].end_time) : s1 + 1;
      const s2 = toDecimalHour(evs[j].start_time);
      const e2 = evs[j].end_time ? toDecimalHour(evs[j].end_time) : s2 + 1;
      if (s1 < e2 && s2 < e1) {
        out.add(evs[i].id);
        out.add(evs[j].id);
      }
    }
  }
  return out;
}

// ── DraggableChip: grid cell chip (replaces renderChip) ──

interface ChipProps {
  ev: JobEvent;
  isOverlapping: boolean;
  compact?: boolean;
  onSelect: (ev: JobEvent) => void;
}

function DraggableChip({ ev, isOverlapping, compact = false, onSelect }: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ev.id });
  const bgColor = isOverlapping ? "#ef4444" : ev.is_verified === false ? "#e5e7eb" : "#dbeafe";
  const textColor = isOverlapping ? "white" : ev.is_verified === false ? "#6b7280" : "#1d4ed8";
  const subColor = isOverlapping ? "rgba(255,255,255,0.8)" : ev.is_verified === false ? "#9ca3af" : "#3b82f6";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onSelect(ev); }}
      className={`rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing hover:brightness-90 transition-all select-none ${isDragging ? "opacity-40" : ""}`}
      style={{ backgroundColor: bgColor, touchAction: "none" }}
    >
      <p className={`${compact ? "text-[9px]" : "text-xs"} font-semibold truncate leading-tight`} style={{ color: textColor }}>
        {ev.title}
      </p>
      {ev.start_time && (
        <p className={`${compact ? "text-[8px]" : "text-[10px]"} leading-tight mt-0.5`} style={{ color: subColor }}>
          {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
        </p>
      )}
      {isOverlapping && <p className="text-[8px] font-bold text-white/90 mt-0.5">⚠ Overlap</p>}
    </div>
  );
}

// ── DraggableTimelineChip: absolute-positioned chip in expanded hour view ──

interface TimelineChipProps {
  ev: JobEvent;
  isOverlap: boolean;
  evHeight: number;
  top: number;
  col: number;
  totalCols: number;
  onSelect: (ev: JobEvent) => void;
}

function DraggableTimelineChip({ ev, isOverlap, evHeight, top, col, totalCols, onSelect }: TimelineChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ev.id });
  const bgColor = isOverlap ? "#ef4444" : ev.is_verified === false ? "#9ca3af" : "#3b82f6";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onSelect(ev); }}
      className={`absolute rounded px-1.5 overflow-hidden cursor-grab active:cursor-grabbing hover:brightness-90 transition-all z-10 select-none ${isDragging ? "opacity-40" : ""}`}
      style={{
        top: top + 1,
        height: evHeight,
        left: `calc(${(col / totalCols) * 100}% + 1px)`,
        width: `calc(${(1 / totalCols) * 100}% - 2px)`,
        backgroundColor: bgColor,
        touchAction: "none",
      }}
    >
      <p className="text-white text-[9px] font-bold truncate leading-tight">{ev.title}</p>
      {evHeight > 22 && ev.start_time && (
        <p className="text-white/80 text-[8px] leading-tight">
          {formatTime(ev.start_time)}{ev.end_time ? `–${formatTime(ev.end_time)}` : ""}
        </p>
      )}
      {isOverlap && evHeight > 32 && <p className="text-white/90 text-[8px] font-bold">⚠ overlap</p>}
    </div>
  );
}

// ── DroppableGridCell: renders a <td> drop target for the main grid ──

interface DroppableGridCellProps {
  cellKey: string;
  evs: JobEvent[];
  overlapping: Set<string>;
  isToday: boolean;
  isDraggingAny: boolean;
  onAddJob: () => void;
  onSelect: (ev: JobEvent) => void;
}

function DroppableGridCell({ cellKey, evs, overlapping, isToday, isDraggingAny, onAddJob, onSelect }: DroppableGridCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cellKey });
  return (
    <td
      ref={setNodeRef}
      className={`border border-gray-100 p-1 align-top transition-colors ${
        isOver ? "bg-blue-100 ring-2 ring-inset ring-blue-400" : isToday ? "bg-blue-50/40" : ""
      }`}
      style={{ minWidth: 100, verticalAlign: "top" }}
      onClick={() => { if (evs.length === 0 && !isDraggingAny) onAddJob(); }}
    >
      {evs.length === 0 ? (
        <div className={`h-10 flex items-center justify-center rounded-lg transition-colors ${
          isOver ? "bg-blue-200/40" : "hover:bg-gray-100/60 cursor-pointer"
        }`}>
          <span className={`text-lg font-light ${isOver ? "text-blue-400" : "text-gray-200"}`}>
            {isOver ? "↓" : "+"}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          {evs.map((ev) => (
            <DraggableChip key={ev.id} ev={ev} isOverlapping={overlapping.has(ev.id)} onSelect={onSelect} />
          ))}
        </div>
      )}
    </td>
  );
}

// ── DroppableExpandedColumn: a day column inside the expanded hour-view ──

interface DroppableExpandedColumnProps {
  cellKey: string;
  dateStr: string;
  di: number;
  isToday: boolean;
  dayEvents: JobEvent[];
  overlapping: Set<string>;
  workerName: string;
  onAddJob: (dateStr: string, workerName: string) => void;
  onSelect: (ev: JobEvent) => void;
}

function DroppableExpandedColumn({
  cellKey, dateStr, di, isToday, dayEvents, overlapping, workerName, onAddJob, onSelect,
}: DroppableExpandedColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cellKey });
  const hasOverlaps = overlapping.size > 0;
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 relative border-l border-gray-200 transition-colors ${isToday ? "bg-blue-50/30" : ""} ${isOver ? "bg-blue-100" : ""}`}
      style={{ height: EXPANDED_HEIGHT }}
    >
      <div className={`h-7 flex items-center justify-center border-b border-gray-200 ${isToday ? "bg-blue-100/60" : "bg-slate-100"}`}>
        <span className={`text-[10px] font-bold ${isToday ? "text-blue-600" : "text-gray-400"}`}>{DAY_NAMES[di]}</span>
        {hasOverlaps && <span className="ml-1 text-[10px] text-red-500" title="Overlapping jobs">⚠</span>}
      </div>
      {HOUR_LABELS.map((_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: COMPACT_HEADER_HEIGHT + i * COMPACT_HOUR_HEIGHT }} />
      ))}
      {HOUR_LABELS.map((_, i) => (
        <div key={`half-${i}`} className="absolute left-0 right-0 border-t border-dashed border-gray-100" style={{ top: COMPACT_HEADER_HEIGHT + i * COMPACT_HOUR_HEIGHT + COMPACT_HOUR_HEIGHT / 2 }} />
      ))}
      {layoutEvents(dayEvents).map(({ ev, col, totalCols }) => {
        const startH = toDecimalHour(ev.start_time);
        const endH = ev.end_time ? toDecimalHour(ev.end_time) : startH + 1;
        const clampedStart = Math.max(startH, COMPACT_START);
        const clampedEnd = Math.min(endH, COMPACT_END);
        if (clampedEnd <= clampedStart) return null;
        const top = COMPACT_HEADER_HEIGHT + (clampedStart - COMPACT_START) * COMPACT_HOUR_HEIGHT;
        const evHeight = Math.max((clampedEnd - clampedStart) * COMPACT_HOUR_HEIGHT - 2, 16);
        return (
          <DraggableTimelineChip
            key={ev.id}
            ev={ev}
            isOverlap={overlapping.has(ev.id)}
            evHeight={evHeight}
            top={top}
            col={col}
            totalCols={totalCols}
            onSelect={onSelect}
          />
        );
      })}
      {dayEvents.length === 0 && (
        <div
          className="absolute inset-x-0 cursor-pointer hover:bg-blue-50/40 transition-colors flex items-center justify-center"
          style={{ top: COMPACT_HEADER_HEIGHT, bottom: 0 }}
          onClick={() => onAddJob(dateStr, workerName)}
        >
          <span className="text-gray-200 text-xl">+</span>
        </div>
      )}
    </div>
  );
}

// ── Main export ──

export default function CrewBoard({ onAddJob, onSelectEvent }: CrewBoardProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [activeEvent, setActiveEvent] = useState<JobEvent | null>(null);
  const [me, setMe] = useState<{ id: string; full_name: string } | null>(null);
  const dragSavingRef = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const weekDates = getWeekDates(weekOffset);
  const from = fmt(weekDates[0]);
  const to = fmt(weekDates[6]);
  const todayStr = fmt(new Date());

  useEffect(() => {
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setWorkers(Array.isArray(data) ? data : []));
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (data?.full_name) setMe(data); });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => { setEvents(Array.isArray(data) ? data : []); setLoading(false); });
  }, [from, to]);

  const crew = workers.filter((w) => w.role === "worker");

  function getEventsForWorkerDay(workerName: string, dateStr: string): JobEvent[] {
    return events.filter((ev) => ev.date === dateStr && isAssignedTo(ev, workerName));
  }

  function getUnassignedEvents(dateStr: string): JobEvent[] {
    const allNamed = [
      ...(me ? [me.full_name] : []),
      ...crew.map((w) => w.full_name),
    ];
    return events.filter((ev) => {
      if (ev.date !== dateStr) return false;
      if (!ev.assigned_to?.trim()) return true;
      return !allNamed.some((name) => isAssignedTo(ev, name));
    });
  }

  const hasUnassigned = weekDates.some((d) => getUnassignedEvents(fmt(d)).length > 0);

  function toggleExpand(name: string) {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function handleDragStart({ active }: DragStartEvent) {
    const ev = events.find((e) => e.id === active.id);
    if (ev) setActiveEvent(ev);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveEvent(null);
    if (!over || dragSavingRef.current) return;

    const eventId = active.id as string;
    const cellKey = over.id as string;
    // cellKey format: "YYYY-MM-DD|workerName" or "YYYY-MM-DD|workerName|expanded"
    const parts = cellKey.split("|");
    const targetDate = parts[0];
    const targetWorker = parts[1];

    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;

    const newAssignedTo = targetWorker === "Unassigned" ? "" : targetWorker;
    if (
      ev.date === targetDate &&
      (newAssignedTo === "" ? !ev.assigned_to?.trim() : isAssignedTo(ev, targetWorker))
    ) return;

    setEvents((prev) =>
      prev.map((e) => e.id === eventId ? { ...e, date: targetDate, assigned_to: newAssignedTo } : e)
    );

    dragSavingRef.current = true;
    try {
      await fetch("/api/events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: eventId, date: targetDate, assigned_to: newAssignedTo }),
      });
    } finally {
      dragSavingRef.current = false;
    }
  }

  function getNavLabel() {
    const d0 = weekDates[0];
    const d6 = weekDates[6];
    if (d0.getMonth() === d6.getMonth()) {
      return `${MONTHS[d0.getMonth()]} ${d0.getDate()} – ${d6.getDate()}, ${d0.getFullYear()}`;
    }
    return `${MONTHS[d0.getMonth()]} ${d0.getDate()} – ${MONTHS[d6.getMonth()]} ${d6.getDate()}, ${d6.getFullYear()}`;
  }

  function renderExpandedRow(workerName: string) {
    const allWeekEvents = weekDates.flatMap((date) =>
      getEventsForWorkerDay(workerName, fmt(date))
    );

    return (
      <tr key={`${workerName}-expanded`}>
        <td colSpan={1 + weekDates.length} className="p-0 border-b-2 border-navy-100">
          <div className="bg-slate-50 overflow-hidden" style={{ height: EXPANDED_HEIGHT }}>
            <div className="flex h-full" style={{ minWidth: 700 }}>
              {/* Time axis */}
              <div className="relative flex-shrink-0 border-r border-gray-200 bg-slate-100" style={{ width: 140 }}>
                <div className="flex items-center gap-2 px-3 h-7 border-b border-gray-200">
                  <span className="text-[9px] font-bold text-navy-600 uppercase tracking-wider">Hour View</span>
                  {allWeekEvents.length > 0 && (
                    <span className="text-[9px] text-gray-400">{allWeekEvents.length} job{allWeekEvents.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
                {HOUR_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="absolute right-2 flex items-start"
                    style={{ top: COMPACT_HEADER_HEIGHT + i * COMPACT_HOUR_HEIGHT, height: COMPACT_HOUR_HEIGHT }}
                  >
                    <span className="text-[9px] text-gray-400 leading-none mt-0.5">{label}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDates.map((date, di) => {
                const dateStr = fmt(date);
                const dayEvents = getEventsForWorkerDay(workerName, dateStr);
                const overlapping = getOverlappingIds(dayEvents);
                const isToday = dateStr === todayStr;
                const cellKey = `${dateStr}|${workerName}|expanded`;
                return (
                  <DroppableExpandedColumn
                    key={dateStr}
                    cellKey={cellKey}
                    dateStr={dateStr}
                    di={di}
                    isToday={isToday}
                    dayEvents={dayEvents}
                    overlapping={overlapping}
                    workerName={workerName}
                    onAddJob={onAddJob}
                    onSelect={onSelectEvent}
                  />
                );
              })}
            </div>
          </div>

          {allWeekEvents.length > 0 && (() => {
            const allOverlaps = weekDates.flatMap((date) => {
              const dayEvs = getEventsForWorkerDay(workerName, fmt(date));
              return [...getOverlappingIds(dayEvs)];
            });
            if (allOverlaps.length === 0) return null;
            const overlapCount = new Set(allOverlaps).size;
            return (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 border-t border-red-100">
                <span className="text-xs text-red-600">⚠</span>
                <span className="text-xs font-semibold text-red-600">
                  {overlapCount} job{overlapCount !== 1 ? "s" : ""} overlap this week — check the red blocks above
                </span>
              </div>
            );
          })()}
        </td>
      </tr>
    );
  }

  const rows: { name: string; isUnassigned: boolean; isMe: boolean }[] = [
    ...(me ? [{ name: me.full_name, isUnassigned: false, isMe: true }] : []),
    ...crew.map((w) => ({ name: w.full_name, isUnassigned: false, isMe: false })),
    ...(hasUnassigned ? [{ name: "Unassigned", isUnassigned: true, isMe: false }] : []),
  ];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div>
        {/* Week nav */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
            >‹</button>
            <h2 className="text-base font-bold text-gray-900">{getNavLabel()}</h2>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl"
            >›</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-sm font-semibold text-navy-600 underline">
                Today
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />
              <span className="text-xs text-gray-500">Assigned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />
              <span className="text-xs text-gray-500">Draft</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-300 inline-block" />
              <span className="text-xs text-gray-500">Overlap</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-400">Loading crew schedule…</p>
          </div>
        ) : crew.length === 0 && !me ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-400">No crew members found. Add workers in the Workers section.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th className="bg-gray-50 border-b border-r border-gray-200 px-3 py-3 text-left" style={{ width: 140, minWidth: 120 }}>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Crew</span>
                    </th>
                    {weekDates.map((date, i) => {
                      const dateStr = fmt(date);
                      const isToday = dateStr === todayStr;
                      return (
                        <th
                          key={dateStr}
                          className={`border-b border-gray-200 px-2 py-2 text-center ${isToday ? "bg-blue-50" : "bg-gray-50"}`}
                          style={{ minWidth: 100 }}
                        >
                          <div className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? "text-blue-500" : "text-gray-400"}`}>
                            {DAY_NAMES[i]}
                          </div>
                          <div className={`text-lg font-extrabold leading-tight ${isToday ? "text-blue-600" : "text-gray-700"}`}>
                            {date.getDate()}
                          </div>
                          <div className={`text-[10px] ${isToday ? "text-blue-400" : "text-gray-400"}`}>
                            {MONTHS[date.getMonth()]}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ name, isUnassigned, isMe }) => {
                    const isExpanded = expandedWorkers.has(name);
                    const weekOverlapCount = weekDates.reduce((count, date) => {
                      const dayEvs = isUnassigned
                        ? getUnassignedEvents(fmt(date))
                        : getEventsForWorkerDay(name, fmt(date));
                      return count + getOverlappingIds(dayEvs).size;
                    }, 0);

                    return (
                      <React.Fragment key={name}>
                        <tr className="group">
                          <td
                            className={`border-r border-b border-gray-100 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors select-none ${
                              isUnassigned ? "bg-orange-50/40 hover:bg-orange-50" :
                              isMe ? "bg-violet-50/40 hover:bg-violet-50" : ""
                            } ${isExpanded ? "bg-gray-50" : ""}`}
                            onClick={() => toggleExpand(name)}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isUnassigned ? "bg-orange-100 text-orange-600" :
                                isMe ? "bg-violet-200 text-violet-700" :
                                "bg-navy-100 text-navy-700"
                              }`}>
                                {isUnassigned ? "?" : name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs font-semibold truncate block ${isUnassigned ? "text-orange-600 italic" : isMe ? "text-violet-700" : "text-gray-800"}`}>
                                  {name}
                                </span>
                                {isMe && <span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wide leading-none">You</span>}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {weekOverlapCount > 0 && (
                                  <span className="text-[10px] text-red-500" title={`${weekOverlapCount} overlapping jobs`}>⚠</span>
                                )}
                                <svg
                                  width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"
                                  className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                >
                                  <polyline points="2,4 6,8 10,4" />
                                </svg>
                              </div>
                            </div>
                          </td>

                          {weekDates.map((date) => {
                            const dateStr = fmt(date);
                            const evs = isUnassigned ? getUnassignedEvents(dateStr) : getEventsForWorkerDay(name, dateStr);
                            const allWorkerEventsThisDay = events.filter((ev) => ev.date === dateStr && isAssignedTo(ev, name));
                            const overlapping = getOverlappingIds(allWorkerEventsThisDay);
                            const isToday = dateStr === todayStr;
                            const cellKey = `${dateStr}|${name}`;
                            return (
                              <DroppableGridCell
                                key={dateStr}
                                cellKey={cellKey}
                                evs={evs}
                                overlapping={overlapping}
                                isToday={isToday}
                                isDraggingAny={activeEvent !== null}
                                onAddJob={() => onAddJob(dateStr, name)}
                                onSelect={onSelectEvent}
                              />
                            );
                          })}
                        </tr>

                        {isExpanded && !isUnassigned && renderExpandedRow(name)}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs text-gray-400">
                {events.length} job{events.length !== 1 ? "s" : ""} this week · {crew.length} crew members
              </span>
              <span className="text-xs text-gray-400">Drag jobs to reassign · Click a name to expand schedule</span>
            </div>
          </div>
        )}

        {/* Ghost chip shown while dragging */}
        <DragOverlay>
          {activeEvent ? (
            <div
              className="rounded-lg px-2 py-1.5 cursor-grabbing select-none shadow-lg opacity-90 pointer-events-none"
              style={{ backgroundColor: activeEvent.is_verified === false ? "#e5e7eb" : "#dbeafe" }}
            >
              <p className="text-xs font-semibold truncate leading-tight" style={{ color: activeEvent.is_verified === false ? "#6b7280" : "#1d4ed8" }}>
                {activeEvent.title}
              </p>
              {activeEvent.start_time && (
                <p className="text-[10px] leading-tight mt-0.5" style={{ color: activeEvent.is_verified === false ? "#9ca3af" : "#3b82f6" }}>
                  {formatTime(activeEvent.start_time)}{activeEvent.end_time ? ` – ${formatTime(activeEvent.end_time)}` : ""}
                </p>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "TallyCrew code" && npx tsc --noEmit 2>&1 | grep -v "^$"
```

Expected: no output (zero errors). If you see errors about `@dnd-kit/core` types, ensure Task 1 completed successfully.

- [ ] **Step 3: Lint**

```bash
cd "TallyCrew code" && npm run lint 2>&1 | tail -10
```

Expected: `✓ No ESLint warnings or errors`.

- [ ] **Step 4: Manual smoke test**

Start the dev server (`npm run dev`), open `http://localhost:3000/admin/calendar` on both:
- Desktop browser: verify drag-and-drop still works with mouse (drag a job chip to a different cell)
- Mobile (or DevTools device emulation at 390px width): verify the grid scrolls horizontally and a long-press + drag moves a job chip

- [ ] **Step 5: Commit**

```bash
cd "TallyCrew code" && git add src/app/admin/calendar/components/CrewBoard.tsx && git commit -m "feat: migrate CrewBoard drag-and-drop to @dnd-kit for touch screen support"
```

---

### Task 3: Workers page — mobile card layout

**Files:**
- Modify: `src/app/admin/workers/page.tsx`

**Interfaces:**
- Consumes: `WageCell` component (unchanged, reused in both mobile and desktop layouts)
- Produces: mobile card per worker (`block md:hidden`) + unchanged desktop grid row (`hidden md:grid`)

**Background:** The current worker list uses `grid-cols-[1fr_auto_auto]` which renders three columns side-by-side. On mobile this is too cramped. The fix shows a card layout on mobile and the original grid on desktop via `hidden md:grid` / `md:hidden`.

- [ ] **Step 1: Replace the worker list section in `src/app/admin/workers/page.tsx`**

Find the `<div className="divide-y divide-gray-100">` block (lines ~162–184) and replace it with:

```tsx
<div className="divide-y divide-gray-100">
  {/* Desktop header row */}
  <div className="hidden md:grid px-5 py-2 grid-cols-[1fr_auto_auto] gap-4 items-center">
    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Name</span>
    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Hourly Wage</span>
    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Role</span>
  </div>
  {workers.map((w) => (
    <div key={w.id}>
      {/* Mobile card */}
      <div className="md:hidden px-4 py-3.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">{w.full_name}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            w.role === "admin" ? "bg-navy-100 text-navy-700" : "bg-gray-100 text-gray-600"
          }`}>
            {w.role}
          </span>
        </div>
        <p className="text-xs text-gray-400">Joined {formatDate(w.created_at)}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">Hourly wage:</span>
          <WageCell worker={w} onSave={saveWage} />
        </div>
      </div>
      {/* Desktop grid row */}
      <div className="hidden md:grid px-5 py-3 grid-cols-[1fr_auto_auto] gap-4 items-center">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{w.full_name}</p>
          <p className="text-xs text-gray-400">Joined {formatDate(w.created_at)}</p>
        </div>
        <WageCell worker={w} onSave={saveWage} />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          w.role === "admin" ? "bg-navy-100 text-navy-700" : "bg-gray-100 text-gray-600"
        }`}>
          {w.role}
        </span>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 2: Make the `WageCell` input large enough for touch**

In the `WageCell` component (lines ~40–54), the editing `<input>` has `py-0.5` (too small for mobile). Change its className:

Find:
```tsx
className="w-20 border border-navy-300 rounded px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-navy-400"
```

Replace with:
```tsx
className="w-20 border border-navy-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-navy-400"
```

- [ ] **Step 3: Type-check and lint**

```bash
cd "TallyCrew code" && npx tsc --noEmit 2>&1 | grep -v "^$" && npm run lint 2>&1 | tail -5
```

Expected: no errors from either command.

- [ ] **Step 4: Manual smoke test**

Open `http://localhost:3000/admin/workers` at 390px width (DevTools). Verify:
- Each worker shows as a card with name + role badge on one line, join date below, wage below that
- Tapping the wage opens the edit input
- At desktop width (≥768px) the original three-column header + row layout is unchanged

- [ ] **Step 5: Commit**

```bash
cd "TallyCrew code" && git add src/app/admin/workers/page.tsx && git commit -m "feat: workers page mobile card layout, desktop unchanged"
```

---

### Task 4: Invoices list — mobile card layout

**Files:**
- Modify: `src/app/admin/invoices/page.tsx`

**Interfaces:**
- Produces: `hidden md:table` table (desktop, unchanged) + `md:hidden` card list (mobile)

**Background:** The invoices list is a `<table>` with 5 columns. On mobile this overflows. The fix wraps the existing table in `hidden md:block` and adds a card list above it with `md:hidden`.

- [ ] **Step 1: Make the status filter tab row full-width on mobile**

Find:
```tsx
<div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-fit">
```

Replace with:
```tsx
<div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-full md:w-fit overflow-x-auto">
```

- [ ] **Step 2: Replace the invoice list block**

Find the block starting with:
```tsx
{visible.length === 0 ? (
```

Replace the entire block (through the closing `}` of the ternary) with:

```tsx
{visible.length === 0 ? (
  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
    {filter === "all" ? (
      <>No invoices yet. <Link href="/admin/invoices/new" className="text-navy-600 underline">Create your first one.</Link></>
    ) : (
      `No ${filter} invoices.`
    )}
  </div>
) : (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    {/* Mobile: card list */}
    <div className="md:hidden divide-y divide-gray-100">
      {visible.map((inv) => (
        <div
          key={inv.id}
          className="px-4 py-3.5 active:bg-gray-50 cursor-pointer"
          onClick={() => { window.location.href = `/admin/invoices/${inv.id}`; }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-gray-900 text-sm">{inv.client_name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[inv.status] ?? statusBadge.draft}`}>
              {inv.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {inv.invoice_number} · {inv.date_from} – {inv.date_to}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              ${Number(inv.total).toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>

    {/* Desktop: table (unchanged) */}
    <table className="hidden md:table w-full text-sm">
      <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <tr>
          <th className="px-5 py-3 text-left">Invoice #</th>
          <th className="px-5 py-3 text-left">Client</th>
          <th className="px-5 py-3 text-left">Date Range</th>
          <th className="px-5 py-3 text-right">Total</th>
          <th className="px-5 py-3 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((inv) => (
          <tr
            key={inv.id}
            className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
            onClick={() => { window.location.href = `/admin/invoices/${inv.id}`; }}
          >
            <td className="px-5 py-3 font-medium text-navy-600">{inv.invoice_number}</td>
            <td className="px-5 py-3 text-gray-900">{inv.client_name}</td>
            <td className="px-5 py-3 text-gray-500">{inv.date_from} – {inv.date_to}</td>
            <td className="px-5 py-3 text-right font-semibold text-gray-900">
              ${Number(inv.total).toFixed(2)}
            </td>
            <td className="px-5 py-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[inv.status] ?? statusBadge.draft}`}>
                {inv.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 3: Type-check and lint**

```bash
cd "TallyCrew code" && npx tsc --noEmit 2>&1 | grep -v "^$" && npm run lint 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Open `http://localhost:3000/admin/invoices` at 390px. Verify:
- Each invoice shows as a card: client name + status badge on top row, invoice number + date range + total on bottom row
- Tapping a card navigates to the invoice detail page
- Filter tabs scroll if they overflow
- At ≥768px: original table layout with 5 columns is unchanged

- [ ] **Step 5: Commit**

```bash
cd "TallyCrew code" && git add src/app/admin/invoices/page.tsx && git commit -m "feat: invoices mobile card layout, desktop table unchanged"
```

---

### Task 5: Admin submissions log — mobile filter row fix

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`

**Background:** The filter row has two inputs side by side. On mobile the name input has a hardcoded `w-48` which prevents it from filling available width. The fix stacks inputs vertically on mobile and removes the fixed width.

- [ ] **Step 1: Fix the filter row**

Find (around line 211):
```tsx
<div className="flex gap-3 mb-6 flex-wrap">
  <input
    type="date"
    value={filterDate}
    onChange={(e) => setFilterDate(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
  />
  <input
    type="text"
    placeholder="Filter by employee name"
    value={filterName}
    onChange={(e) => setFilterName(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 w-48"
  />
  {(filterDate || filterName) && (
    <button onClick={() => { setFilterDate(""); setFilterName(""); }} className="text-sm text-navy-600 underline">
      Clear filters
    </button>
  )}
</div>
```

Replace with:
```tsx
<div className="flex flex-col md:flex-row gap-3 mb-6">
  <input
    type="date"
    value={filterDate}
    onChange={(e) => setFilterDate(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 w-full md:w-auto"
  />
  <input
    type="text"
    placeholder="Filter by employee name"
    value={filterName}
    onChange={(e) => setFilterName(e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 w-full md:w-48"
  />
  {(filterDate || filterName) && (
    <button onClick={() => { setFilterDate(""); setFilterName(""); }} className="text-sm text-navy-600 underline self-start md:self-center">
      Clear filters
    </button>
  )}
</div>
```

- [ ] **Step 2: Type-check and lint**

```bash
cd "TallyCrew code" && npx tsc --noEmit 2>&1 | grep -v "^$" && npm run lint 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Open `http://localhost:3000/admin/dashboard` at 390px. Verify:
- Date input and name input are stacked vertically, each full-width
- "Clear filters" link appears below the inputs when either filter is active
- At ≥768px: inputs are side by side, name input is `w-48`, unchanged from before

- [ ] **Step 4: Commit**

```bash
cd "TallyCrew code" && git add src/app/admin/dashboard/page.tsx && git commit -m "feat: admin logs filter row stacks vertically on mobile"
```

---

### Task 6: Admin forms — touch target fixes

**Files:**
- Modify: `src/app/admin/log-config/page.tsx`
- Modify: `src/app/admin/home/page.tsx` (if announcement form exists inline) or `src/components/AdminDashboardView.tsx`

**Background:** Several action buttons have `py-1` or `py-1.5` (below 44px touch height). The `⋮` menu button in log-config is `w-8 h-8` (32px). These need to meet the 44px minimum on mobile without changing the desktop layout.

- [ ] **Step 1: Fix the three-dot menu button in log-config**

In `src/app/admin/log-config/page.tsx`, find the `⋮` menu button (around line 285–290):

```tsx
className="w-8 h-8 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
```

Replace with:
```tsx
className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
```

- [ ] **Step 2: Fix the "Preview" / "Add type" button in log-config**

Find the button with `className` containing `py-1.5` near the page header (around line 247):

```tsx
className="shrink-0 text-sm font-semibold text-navy-600 border border-navy-300 hover:bg-navy-50 rounded-lg px-3 py-1.5 transition-colors"
```

Replace with:
```tsx
className="shrink-0 text-sm font-semibold text-navy-600 border border-navy-300 hover:bg-navy-50 rounded-lg px-3 py-2.5 md:py-1.5 transition-colors"
```

- [ ] **Step 3: Fix the "Add field" button inside each expanded log type**

Find (around line 313):
```tsx
className="text-xs border border-navy-300 text-navy-600 rounded-lg px-3 py-1 hover:bg-navy-50 transition-colors"
```

Replace with:
```tsx
className="text-xs border border-navy-300 text-navy-600 rounded-lg px-3 py-2 md:py-1 hover:bg-navy-50 transition-colors"
```

- [ ] **Step 4: Fix the AdminDashboardView announcement form inputs and post button**

In `src/components/AdminDashboardView.tsx`, the announcement form `<input>` and `<textarea>` both use `py-2`. Replace both:

Find (appears twice — once on `<input>`, once on `<textarea>`):
```tsx
className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
```
Replace with:
```tsx
className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
```

Also fix the Post button which uses `py-1.5`:
```tsx
className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity"
```
Replace with:
```tsx
className="text-sm font-semibold px-4 py-2.5 md:py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity"
```

- [ ] **Step 5: Type-check and lint**

```bash
cd "TallyCrew code" && npx tsc --noEmit 2>&1 | grep -v "^$" && npm run lint 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Open `http://localhost:3000/admin/log-config` at 390px. Verify:
- The `⋮` menu button is large enough to tap comfortably
- The "Preview" and field management buttons have adequate tap height
- Open `http://localhost:3000/admin/home` at 390px: announcement form inputs are full-width and easy to type in
- At ≥768px: all buttons visually unchanged

- [ ] **Step 7: Commit**

```bash
cd "TallyCrew code" && git add src/app/admin/log-config/page.tsx src/components/AdminDashboardView.tsx && git commit -m "feat: admin forms — 44px touch targets on mobile action buttons"
```

---

## Verification Checklist

After all tasks complete, test these on a real phone or DevTools at 390px width:

- [ ] `/admin/calendar` — drag a job chip to a different worker column (touch drag works)
- [ ] `/admin/calendar` — horizontal scroll reveals all workers and days
- [ ] `/admin/workers` — worker list shows as cards on mobile
- [ ] `/admin/invoices` — invoice list shows as cards; tapping navigates to detail
- [ ] `/admin/dashboard` — filter inputs stack vertically, full width
- [ ] `/admin/log-config` — all buttons have comfortable tap targets
- [ ] `/admin/home` — announcement form inputs are full width

Then verify desktop at ≥768px for each of the above — layout must be identical to before these changes.
