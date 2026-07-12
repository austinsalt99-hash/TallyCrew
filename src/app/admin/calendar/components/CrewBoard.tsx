"use client";

import React, { useEffect, useRef, useState } from "react";

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

export default function CrewBoard({ onAddJob, onSelectEvent }: CrewBoardProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [dragOverCell, setDragOverCell] = useState<string | null>(null); // "date|worker"
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string; full_name: string } | null>(null);
  const dragSavingRef = useRef(false);

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

  // ── Drag handlers ──

  function handleDragStart(e: React.DragEvent, ev: JobEvent) {
    e.dataTransfer.setData("eventId", ev.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(ev.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCell(null);
  }

  function handleDragOver(e: React.DragEvent, cellKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  }

  function handleDragLeave(cellKey: string) {
    setDragOverCell((prev) => (prev === cellKey ? null : prev));
  }

  async function handleDrop(targetDate: string, targetWorker: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverCell(null);
    setDraggingId(null);

    const eventId = e.dataTransfer.getData("eventId");
    if (!eventId || dragSavingRef.current) return;

    const ev = events.find((ev) => ev.id === eventId);
    if (!ev) return;

    const newAssignedTo = targetWorker === "Unassigned" ? "" : targetWorker;

    // Skip if nothing changed
    if (ev.date === targetDate && (newAssignedTo === "" ? !ev.assigned_to?.trim() : isAssignedTo(ev, targetWorker))) return;

    // Optimistic update
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, date: targetDate, assigned_to: newAssignedTo } : e));

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

  // ── Render chip (used in both grid cell and expanded timeline) ──

  function renderChip(ev: JobEvent, isOverlapping: boolean, compact = false) {
    const isUnverified = ev.is_verified === false;
    const isDragging = draggingId === ev.id;
    const bgColor = isOverlapping ? "#ef4444" : isUnverified ? "#e5e7eb" : "#dbeafe";
    const textColor = isOverlapping ? "white" : isUnverified ? "#6b7280" : "#1d4ed8";
    const subColor = isOverlapping ? "rgba(255,255,255,0.8)" : isUnverified ? "#9ca3af" : "#3b82f6";

    return (
      <div
        key={ev.id}
        draggable
        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ev); }}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }}
        className={`rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing hover:brightness-90 transition-all select-none ${isDragging ? "opacity-40" : ""}`}
        style={{ backgroundColor: bgColor }}
      >
        <p className={`${compact ? "text-[9px]" : "text-xs"} font-semibold truncate leading-tight`} style={{ color: textColor }}>
          {ev.title}
        </p>
        {ev.start_time && (
          <p className={`${compact ? "text-[8px]" : "text-[10px]"} leading-tight mt-0.5`} style={{ color: subColor }}>
            {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
          </p>
        )}
        {isOverlapping && (
          <p className="text-[8px] font-bold text-white/90 mt-0.5">⚠ Overlap</p>
        )}
      </div>
    );
  }

  // ── Grid cell ──

  function renderCell(workerName: string, dateStr: string, isUnassigned: boolean) {
    const evs = isUnassigned ? getUnassignedEvents(dateStr) : getEventsForWorkerDay(workerName, dateStr);
    const allWorkerEventsThisDay = events.filter((ev) => ev.date === dateStr && isAssignedTo(ev, workerName));
    const overlapping = getOverlappingIds(allWorkerEventsThisDay);
    const isToday = dateStr === todayStr;
    const cellKey = `${dateStr}|${workerName}`;
    const isDropTarget = dragOverCell === cellKey;

    return (
      <td
        key={dateStr}
        className={`border border-gray-100 p-1 align-top transition-colors ${
          isDropTarget ? "bg-blue-100 ring-2 ring-inset ring-blue-400" :
          isToday ? "bg-blue-50/40" : ""
        }`}
        style={{ minWidth: 100, verticalAlign: "top" }}
        onDragOver={(e) => handleDragOver(e, cellKey)}
        onDragLeave={() => handleDragLeave(cellKey)}
        onDrop={(e) => handleDrop(dateStr, workerName, e)}
        onClick={() => { if (evs.length === 0 && !draggingId) onAddJob(dateStr, workerName); }}
      >
        {evs.length === 0 ? (
          <div className={`h-10 flex items-center justify-center rounded-lg transition-colors ${
            isDropTarget ? "bg-blue-200/40" : "hover:bg-gray-100/60 cursor-pointer"
          }`}>
            <span className={`text-lg font-light ${isDropTarget ? "text-blue-400" : "text-gray-200"}`}>
              {isDropTarget ? "↓" : "+"}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {evs.map((ev) => renderChip(ev, overlapping.has(ev.id)))}
          </div>
        )}
      </td>
    );
  }

  // ── Expanded timeline row ──

  function renderExpandedRow(workerName: string) {
    const allWeekEvents = weekDates.flatMap((date) => {
      const dateStr = fmt(date);
      return getEventsForWorkerDay(workerName, dateStr);
    });
    const hasAnyEvents = allWeekEvents.length > 0;

    return (
      <tr key={`${workerName}-expanded`}>
        <td colSpan={1 + weekDates.length} className="p-0 border-b-2 border-navy-100">
          <div
            className="bg-slate-50 overflow-hidden"
            style={{ height: EXPANDED_HEIGHT }}
          >
            <div className="flex h-full" style={{ minWidth: 700 }}>

              {/* Time axis */}
              <div
                className="relative flex-shrink-0 border-r border-gray-200 bg-slate-100"
                style={{ width: 140 }}
              >
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
                const hasOverlaps = overlapping.size > 0;
                const isToday = dateStr === todayStr;
                const cellKey = `${dateStr}|${workerName}|expanded`;

                return (
                  <div
                    key={dateStr}
                    className={`flex-1 relative border-l border-gray-200 transition-colors ${
                      isToday ? "bg-blue-50/30" : ""
                    } ${dragOverCell === cellKey ? "bg-blue-100" : ""}`}
                    style={{ height: EXPANDED_HEIGHT }}
                    onDragOver={(e) => handleDragOver(e, cellKey)}
                    onDragLeave={() => handleDragLeave(cellKey)}
                    onDrop={(e) => handleDrop(dateStr, workerName, e)}
                  >
                    {/* Day header */}
                    <div className={`h-7 flex items-center justify-center border-b border-gray-200 ${isToday ? "bg-blue-100/60" : "bg-slate-100"}`}>
                      <span className={`text-[10px] font-bold ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                        {DAY_NAMES[di]}
                      </span>
                      {hasOverlaps && (
                        <span className="ml-1 text-[10px] text-red-500" title="Overlapping jobs">⚠</span>
                      )}
                    </div>

                    {/* Hour lines */}
                    {HOUR_LABELS.map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: COMPACT_HEADER_HEIGHT + i * COMPACT_HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Half-hour dotted lines */}
                    {HOUR_LABELS.map((_, i) => (
                      <div
                        key={`half-${i}`}
                        className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                        style={{ top: COMPACT_HEADER_HEIGHT + i * COMPACT_HOUR_HEIGHT + COMPACT_HOUR_HEIGHT / 2 }}
                      />
                    ))}

                    {/* Events */}
                    {layoutEvents(dayEvents).map(({ ev, col, totalCols }) => {
                      const startH = toDecimalHour(ev.start_time);
                      const endH = ev.end_time ? toDecimalHour(ev.end_time) : startH + 1;
                      const clampedStart = Math.max(startH, COMPACT_START);
                      const clampedEnd = Math.min(endH, COMPACT_END);
                      if (clampedEnd <= clampedStart) return null;
                      const top = COMPACT_HEADER_HEIGHT + (clampedStart - COMPACT_START) * COMPACT_HOUR_HEIGHT;
                      const evHeight = Math.max((clampedEnd - clampedStart) * COMPACT_HOUR_HEIGHT - 2, 16);
                      const isOverlap = overlapping.has(ev.id);
                      const isUnverified = ev.is_verified === false;
                      const isDragging = draggingId === ev.id;
                      const bgColor = isOverlap ? "#ef4444" : isUnverified ? "#9ca3af" : "#3b82f6";

                      return (
                        <div
                          key={ev.id}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ev); }}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }}
                          className={`absolute rounded px-1.5 overflow-hidden cursor-grab active:cursor-grabbing hover:brightness-90 transition-all z-10 select-none ${isDragging ? "opacity-40" : ""}`}
                          style={{
                            top: top + 1,
                            height: evHeight,
                            left: `calc(${(col / totalCols) * 100}% + 1px)`,
                            width: `calc(${(1 / totalCols) * 100}% - 2px)`,
                            backgroundColor: bgColor,
                          }}
                        >
                          <p className="text-white text-[9px] font-bold truncate leading-tight">{ev.title}</p>
                          {evHeight > 22 && ev.start_time && (
                            <p className="text-white/80 text-[8px] leading-tight">
                              {formatTime(ev.start_time)}{ev.end_time ? `–${formatTime(ev.end_time)}` : ""}
                            </p>
                          )}
                          {isOverlap && evHeight > 32 && (
                            <p className="text-white/90 text-[8px] font-bold">⚠ overlap</p>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty day click target */}
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
              })}
            </div>
          </div>

          {/* Overlap warning bar */}
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
    <div>
      {/* Nav */}
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
                  // Check if this worker has any overlaps this week
                  const weekOverlapCount = weekDates.reduce((count, date) => {
                    const dayEvs = isUnassigned
                      ? getUnassignedEvents(fmt(date))
                      : getEventsForWorkerDay(name, fmt(date));
                    return count + getOverlappingIds(dayEvs).size;
                  }, 0);

                  return (
                    <React.Fragment key={name}>
                      <tr className="group">
                        {/* Worker name cell — click to expand */}
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

                        {/* Day cells */}
                        {weekDates.map((date) => {
                          const dateStr = fmt(date);
                          return renderCell(name, dateStr, isUnassigned);
                        })}
                      </tr>

                      {/* Expanded timeline row */}
                      {isExpanded && !isUnassigned && renderExpandedRow(name)}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-1">
            <span className="text-xs text-gray-400">
              {events.length} job{events.length !== 1 ? "s" : ""} this week · {crew.length} crew members
            </span>
            <span className="text-xs text-gray-400">Drag jobs to reassign · Click a name to expand schedule</span>
          </div>
        </div>
      )}
    </div>
  );
}
