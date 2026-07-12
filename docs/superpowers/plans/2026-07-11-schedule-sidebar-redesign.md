# Schedule Sidebar Redesign & My Plan Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overlay My Plan events (meetings, site visits, tasks, reminders, notes) onto the Schedule tab calendar, give each event type a distinct color with a left-border + tinted card, and add a collapsible left sidebar with type toggles, quick-add buttons, and filters.

**Architecture:** Extract shared event-type constants → create a reusable `PlanEventModal` → build `ScheduleSidebar` → add plan-events fetch + `UnifiedEvent` merge to `page.tsx` → update all four calendar views to render `UnifiedEvent[]` with type-based colors/icons.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Supabase (existing), inline SVG icons (no icon library — match existing codebase style)

## Global Constraints

- Tailwind CSS only, no component library
- Inline SVG icons only (the codebase has no icon library)
- Never query across companies; all data scoped to `profile.company_id`
- No test suite exists — verify with TypeScript (`npx tsc --noEmit`) and manual browser testing
- Delete `.next` and restart dev server if you see `ENOENT: no such file or directory` errors referencing `.next/server/...` files
- `"use client"` required at the top of all new component files in `src/app/admin/`
- Plan events (`admin_plan_events` table) may not be migrated in all environments — `page.tsx` must handle a fetch error/empty gracefully (already handled by `Array.isArray` guard)

---

## File Map

| Status | Path | Role |
|--------|------|------|
| **Create** | `src/app/admin/calendar/constants/eventTypes.ts` | Shared EVENT_TYPES record + PlanEvent type, imported by MyPlanView + ScheduleSidebar + page.tsx |
| **Create** | `src/app/admin/calendar/components/PlanEventModal.tsx` | Self-contained modal for creating/editing plan events; replaces inline form in MyPlanView |
| **Modify** | `src/app/admin/calendar/components/MyPlanView.tsx` | Import EVENT_TYPES + PlanEvent from constants; swap inline modal for PlanEventModal |
| **Create** | `src/app/admin/calendar/components/ScheduleSidebar.tsx` | Collapsible left sidebar: type legend/toggles, quick-add, filters |
| **Modify** | `src/app/admin/calendar/page.tsx` | Add plan-events fetch, UnifiedEvent interface, visibleTypes state, sidebar layout, updated renders |

---

## Task 1: Extract shared EVENT_TYPES constant

**Files:**
- Create: `src/app/admin/calendar/constants/eventTypes.ts`

**Interfaces:**
- Produces: `EVENT_TYPES`, `EventType`, `PlanEvent` (used by Tasks 2, 3, 5, 7)

- [ ] **Step 1: Create the file**

```typescript
// src/app/admin/calendar/constants/eventTypes.ts

export const EVENT_TYPES = {
  meeting:      { label: "Meeting",    color: "#7c3aed", bg: "#ede9fe", dot: "bg-violet-400" },
  "site-visit": { label: "Site Visit", color: "#ea580c", bg: "#ffedd5", dot: "bg-orange-400" },
  task:         { label: "Task",       color: "#16a34a", bg: "#dcfce7", dot: "bg-green-400" },
  reminder:     { label: "Reminder",   color: "#d97706", bg: "#fef3c7", dot: "bg-amber-400" },
  note:         { label: "Note",       color: "#2563eb", bg: "#dbeafe", dot: "bg-blue-400" },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export const JOB_TYPE_CONFIG = {
  job:        { label: "Jobs",       color: "#F4A823", bg: "#FFF8EC" },
  "draft-job":{ label: "Draft Jobs", color: "#9ca3af", bg: "#f3f4f6" },
} as const;

export type UnifiedEventType = EventType | "job" | "draft-job";

export const ALL_TYPE_CONFIGS: Record<string, { label: string; color: string; bg: string }> = {
  job:          { label: "Jobs",       color: "#F4A823", bg: "#FFF8EC" },
  "draft-job":  { label: "Draft Jobs", color: "#9ca3af", bg: "#f3f4f6" },
  ...Object.fromEntries(
    Object.entries(EVENT_TYPES).map(([k, v]) => [k, { label: v.label, color: v.color, bg: v.bg }])
  ),
};

export interface PlanEvent {
  id: string;
  title: string;
  event_type: EventType;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
  location: string;
  attendees: string;
  is_done: boolean;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (file is new and not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/constants/eventTypes.ts && git commit -m "feat: extract shared EVENT_TYPES and PlanEvent to constants"
```

---

## Task 2: Create PlanEventModal component

**Files:**
- Create: `src/app/admin/calendar/components/PlanEventModal.tsx`

**Interfaces:**
- Consumes: `EVENT_TYPES`, `EventType`, `PlanEvent` from `../constants/eventTypes`
- Produces: `<PlanEventModal open onClose onSave initialType? initialDate? editEvent? />` — used by Tasks 3 and 6

The modal handles its own form state and POSTs/PUTs to `/api/admin/plan-events`.

- [ ] **Step 1: Create PlanEventModal.tsx**

```typescript
// src/app/admin/calendar/components/PlanEventModal.tsx
"use client";

import { useState, useEffect } from "react";
import { EVENT_TYPES, EventType, PlanEvent } from "../constants/eventTypes";

const EMPTY_FORM = {
  title: "",
  event_type: "task" as EventType,
  date: "",
  start_time: "",
  end_time: "",
  description: "",
  location: "",
  attendees: "",
  is_done: false,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (saved: PlanEvent) => void;
  initialType?: EventType;
  initialDate?: string;
  editEvent?: PlanEvent | null;
}

export default function PlanEventModal({ open, onClose, onSave, initialType, initialDate, editEvent }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setForm({
        title: editEvent.title,
        event_type: editEvent.event_type,
        date: editEvent.date,
        start_time: editEvent.start_time ?? "",
        end_time: editEvent.end_time ?? "",
        description: editEvent.description ?? "",
        location: editEvent.location ?? "",
        attendees: editEvent.attendees ?? "",
        is_done: editEvent.is_done,
      });
    } else {
      setForm({ ...EMPTY_FORM, event_type: initialType ?? "task", date: initialDate ?? "" });
    }
  }, [open, editEvent, initialType, initialDate]);

  if (!open) return null;

  async function handleSave() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    const method = editEvent ? "PUT" : "POST";
    const body = editEvent ? { id: editEvent.id, ...form } : form;
    const res = await fetch("/api/admin/plan-events", {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const saved = await res.json();
    onSave(saved);
    setSaving(false);
  }

  const typeConfig = EVENT_TYPES[form.event_type];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: typeConfig.color }} />
          <h2 className="text-lg font-bold text-gray-900">{editEvent ? "Edit" : "Add"} {typeConfig.label}</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, event_type: t })}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors"
                  style={
                    form.event_type === t
                      ? { backgroundColor: EVENT_TYPES[t].bg, borderColor: EVENT_TYPES[t].color, color: EVENT_TYPES[t].color }
                      : { backgroundColor: "white", borderColor: "#e5e7eb", color: "#6b7280" }
                  }
                >
                  {EVENT_TYPES[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              placeholder={`${typeConfig.label} title`}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.date}
            className="flex-1 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: typeConfig.color }}
          >
            {saving ? "Saving…" : editEvent ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/components/PlanEventModal.tsx && git commit -m "feat: add PlanEventModal reusable component"
```

---

## Task 3: Update MyPlanView to use shared constants + PlanEventModal

**Files:**
- Modify: `src/app/admin/calendar/components/MyPlanView.tsx`

**What changes:**
1. Remove the local `EVENT_TYPES` const and `PlanEvent` / `EventType` type definitions (lines 7–28)
2. Add imports from `../constants/eventTypes` and `./PlanEventModal`
3. Replace the inline `{showForm && (...)}` modal JSX block with `<PlanEventModal>`

- [ ] **Step 1: Replace local definitions with imports**

At the top of `MyPlanView.tsx`, replace lines 7–28 (the local `const EVENT_TYPES = ...`, `type EventType`, `interface PlanEvent`, `interface CrewJob`) with:

```typescript
import { EVENT_TYPES, EventType, PlanEvent } from "../constants/eventTypes";
import PlanEventModal from "./PlanEventModal";
```

Keep the `CrewJob` interface in MyPlanView.tsx (it is not shared):

```typescript
interface CrewJob {
  id: string;
  date: string;
  title: string;
  assigned_to: string;
  start_time: string;
  end_time: string;
  client: string;
  is_verified: boolean;
}
```

- [ ] **Step 2: Replace the showForm modal block**

Find the existing inline form modal in MyPlanView.tsx (the block starting with `{showForm && (` that renders the "Add / Edit plan event" form). Remove it entirely and replace with this at the bottom of the component return, just before the closing `</div>`:

```tsx
<PlanEventModal
  open={showForm}
  onClose={() => setShowForm(false)}
  onSave={(saved) => {
    if (editId) {
      setPlanEvents((prev) => prev.map((e) => e.id === editId ? saved : e));
    } else {
      setPlanEvents((prev) => [...prev, saved]);
    }
    setShowForm(false);
    setEditId(null);
  }}
  initialType={form.event_type}
  initialDate={form.date}
  editEvent={editId ? planEvents.find((e) => e.id === editId) ?? null : null}
/>
```

The existing `openNew` and `openEdit` functions in MyPlanView can stay as-is — they set `form`, `editId`, and `setShowForm(true)` just as before, and `PlanEventModal` reads `initialType`/`initialDate`/`editEvent` from those.

- [ ] **Step 3: Verify TypeScript compiles and My Plan tab still works**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

Manual check: start dev server (`npm run dev`), go to `/admin/calendar` → "My Plan" tab → confirm adding/editing plan events still works.

- [ ] **Step 4: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/components/MyPlanView.tsx && git commit -m "refactor: use shared EVENT_TYPES and PlanEventModal in MyPlanView"
```

---

## Task 4: Build ScheduleSidebar component

**Files:**
- Create: `src/app/admin/calendar/components/ScheduleSidebar.tsx`

**Interfaces:**
- Consumes: `ALL_TYPE_CONFIGS`, `EventType` from `../constants/eventTypes`
- Produces: `<ScheduleSidebar .../>` with these props:

```typescript
interface ScheduleSidebarProps {
  visibleTypes: Set<string>;
  onToggleType: (type: string) => void;
  filterEmployee: string;
  onEmployeeFilterChange: (v: string) => void;
  filterStatus: "all" | "verified" | "unverified";
  onStatusFilterChange: (v: "all" | "verified" | "unverified") => void;
  workerNames: string[];
  onQuickAdd: (type: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}
```

- [ ] **Step 1: Create ScheduleSidebar.tsx**

```typescript
// src/app/admin/calendar/components/ScheduleSidebar.tsx
"use client";

import { ALL_TYPE_CONFIGS } from "../constants/eventTypes";

const TYPE_ORDER = ["job", "draft-job", "meeting", "site-visit", "task", "reminder", "note"] as const;

// Small inline SVG icons keyed by type
function TypeIcon({ type, color }: { type: string; color: string }) {
  const cls = `flex-shrink-0`;
  if (type === "job" || type === "draft-job") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
  if (type === "meeting") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  if (type === "site-visit") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
  if (type === "task") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
  if (type === "reminder") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
  return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

interface ScheduleSidebarProps {
  visibleTypes: Set<string>;
  onToggleType: (type: string) => void;
  filterEmployee: string;
  onEmployeeFilterChange: (v: string) => void;
  filterStatus: "all" | "verified" | "unverified";
  onStatusFilterChange: (v: "all" | "verified" | "unverified") => void;
  workerNames: string[];
  onQuickAdd: (type: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ScheduleSidebar({
  visibleTypes,
  onToggleType,
  filterEmployee,
  onEmployeeFilterChange,
  filterStatus,
  onStatusFilterChange,
  workerNames,
  onQuickAdd,
  isCollapsed,
  onToggleCollapse,
}: ScheduleSidebarProps) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 px-1.5 bg-white rounded-2xl border border-gray-200 shadow-sm w-9 flex-shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          title="Expand sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div className="w-px h-4 bg-gray-200" />
        {TYPE_ORDER.map((type) => {
          const cfg = ALL_TYPE_CONFIGS[type];
          const active = visibleTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              title={cfg.label}
              className="w-5 h-5 rounded-full flex-shrink-0 transition-opacity"
              style={{ backgroundColor: cfg.color, opacity: active ? 1 : 0.25 }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm w-52 flex-shrink-0 self-start">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Calendar</span>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          title="Collapse sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      {/* Event type toggles */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Event Types</p>
        <div className="space-y-1">
          {TYPE_ORDER.map((type) => {
            const cfg = ALL_TYPE_CONFIGS[type];
            const active = visibleTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggleType(type)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-opacity" style={{ backgroundColor: cfg.color, opacity: active ? 1 : 0.3 }} />
                <span className={`text-xs font-medium flex-1 truncate transition-colors ${active ? "text-gray-700" : "text-gray-400"}`}>{cfg.label}</span>
                {/* Toggle pill */}
                <div className={`w-7 h-3.5 rounded-full transition-colors flex-shrink-0 relative ${active ? "bg-navy-500" : "bg-gray-200"}`}>
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Add */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Add</p>
        <div className="space-y-1">
          {TYPE_ORDER.map((type) => {
            const cfg = ALL_TYPE_CONFIGS[type];
            if (type === "draft-job") return null; // Can't manually create a draft job
            return (
              <button
                key={type}
                onClick={() => onQuickAdd(type)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <TypeIcon type={type} color={cfg.color} />
                <span className="text-xs text-gray-600">+ {cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filters</p>
        <div className="space-y-2">
          <select
            value={filterEmployee}
            onChange={(e) => onEmployeeFilterChange(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-navy-400"
          >
            <option value="">All Employees</option>
            {workerNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["all", "verified", "unverified"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStatusFilterChange(s)}
                className={`flex-1 py-1 text-[10px] font-semibold transition-colors ${filterStatus === s ? "bg-navy-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                {s === "all" ? "All" : s === "verified" ? "Active" : "Draft"}
              </button>
            ))}
          </div>
          {(filterEmployee || filterStatus !== "all") && (
            <button
              onClick={() => { onEmployeeFilterChange(""); onStatusFilterChange("all"); }}
              className="text-[10px] text-gray-400 hover:text-gray-600 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/components/ScheduleSidebar.tsx && git commit -m "feat: add ScheduleSidebar with type toggles, quick-add, and filters"
```

---

## Task 5: Add plan events state, UnifiedEvent, and type helpers to page.tsx

**Files:**
- Modify: `src/app/admin/calendar/page.tsx`

This task adds the data layer changes only. No rendering changes yet.

- [ ] **Step 1: Add imports at the top of page.tsx**

After the existing import of `MyPlanView`, add:

```typescript
import { ALL_TYPE_CONFIGS, PlanEvent, UnifiedEventType } from "./constants/eventTypes";
import ScheduleSidebar from "./components/ScheduleSidebar";
import PlanEventModal from "./components/PlanEventModal";
```

- [ ] **Step 2: Add UnifiedEvent interface**

After the existing `interface JobEvent { ... }` block, add:

```typescript
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
```

- [ ] **Step 3: Update layoutEvents to accept UnifiedEvent[]**

Find the existing `function layoutEvents(evs: JobEvent[])` and change its signature and return type:

```typescript
function layoutEvents(evs: UnifiedEvent[]): { ev: UnifiedEvent; col: number; totalCols: number }[] {
```

The function body is identical — only the type annotation changes.

- [ ] **Step 4: Add new state variables inside AdminCalendar()**

After the existing `const [filterStatus, setFilterStatus] = useState(...)` line, add:

```typescript
const [planEvents, setPlanEvents] = useState<PlanEvent[]>([]);
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
  new Set(["job", "draft-job", "meeting", "site-visit", "task", "reminder", "note"])
);
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [planModalOpen, setPlanModalOpen] = useState(false);
const [planModalType, setPlanModalType] = useState<string>("task");
const [planModalDate, setPlanModalDate] = useState<string>("");
```

- [ ] **Step 5: Add plan events fetch useEffect**

After the existing `useEffect` that fetches `/api/events`, add:

```typescript
useEffect(() => {
  if (calTab !== "schedule") return;
  fetch(`/api/admin/plan-events?from=${fetchFrom}&to=${fetchTo}`, { credentials: "include" })
    .then((r) => { if (!r.ok) return []; return r.json(); })
    .then((data) => setPlanEvents(Array.isArray(data) ? data : []));
}, [fetchFrom, fetchTo, calTab]);
```

- [ ] **Step 6: Add unifiedEvents computed value**

Replace the existing `const filteredEvents = events.filter(...)` block with:

```typescript
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
```

- [ ] **Step 7: Add onQuickAdd handler**

After the existing `function goToday()` function, add:

```typescript
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
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -30
```

Expected: possible errors about `filteredEvents` being used but renamed — fix any remaining references: do a search-and-replace of `filteredEvents` → `unifiedEvents` in page.tsx.

```bash
grep -n "filteredEvents" "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code/src/app/admin/calendar/page.tsx"
```

For each hit: replace `filteredEvents` with `unifiedEvents` manually. Then re-run tsc.

- [ ] **Step 9: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/page.tsx && git commit -m "feat: add plan events fetch and UnifiedEvent merge to Schedule tab"
```

---

## Task 6: Wire sidebar + PlanEventModal into the Schedule tab layout

**Files:**
- Modify: `src/app/admin/calendar/page.tsx`

This task adds the sidebar to the DOM and the plan event quick-add modal.

- [ ] **Step 1: Add PlanEventModal to the Schedule tab JSX**

Find where the existing `{showForm && (...)}` modal is (near the bottom of the return, around line 1304). Right before it, add:

```tsx
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
```

- [ ] **Step 2: Add ScheduleSidebar to the Schedule tab layout**

Find the `{calTab === "schedule" && (` block. Inside it, find the section that wraps the calendar and details panel — there should be a `<div className="flex flex-col ...">` that contains the calendar grid and the optional details panel.

Wrap that entire section with a flex row that includes the sidebar on the left. The existing structure looks like:

```tsx
{/* Calendar + Details split layout */}
<div className={`flex flex-col ${selectedEvent ? "md:flex-row md:gap-4 md:items-start" : ""}`}>
  <div className={selectedEvent ? "md:w-1/2" : ""}>
    {/* month / week / day / list views */}
  </div>
  {selectedEvent && (
    <div className="mt-4 md:mt-0 md:w-1/2">{renderDetailsPanel()}</div>
  )}
</div>
```

Change it to wrap with a sidebar row:

```tsx
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
        {/* month / week / day / list views */}
      </div>
      {selectedEvent && (
        <div className="mt-4 md:mt-0 md:w-1/2">{renderDetailsPanel()}</div>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 3: Remove the old top filter bar**

Find and delete the `{/* Filter bar */}` block (around lines 1097–1133) — the `<div className="flex items-center gap-2 flex-wrap">` that contains the employee select and the All/Active/Drafts buttons. This has moved into the sidebar. The "X of Y jobs" count display is also removed (no longer needed — sidebar shows active toggle state).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Smoke test in browser**

Start the dev server and check:
- Sidebar renders on the left of the Schedule tab
- Collapse button hides it to icon rail; expand button restores
- Employee filter in sidebar works (changes which jobs appear)
- Status filter in sidebar works (All/Active/Draft buttons)
- "+ Job" Quick Add opens the existing job modal
- "+ Meeting" opens the PlanEventModal pre-set to Meeting type

- [ ] **Step 6: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/page.tsx && git commit -m "feat: wire ScheduleSidebar and PlanEventModal into Schedule tab"
```

---

## Task 7: Update event card rendering with UnifiedEvent colors and icons

**Files:**
- Modify: `src/app/admin/calendar/page.tsx` — the `renderTimeGrid`, `renderListView`, and month-view JSX

This task is the visual payoff: orange jobs, tinted backgrounds, left borders, type icons.

- [ ] **Step 1: Add getEventStyle helper function (module level)**

Add this after `function toDecimalHour(...)`:

```typescript
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
```

- [ ] **Step 2: Update the time-grid event block (week/day view)**

Inside `renderTimeGrid`, find the `<div key={ev.id} draggable ...>` event block (around line 710). Replace it entirely with:

```tsx
const { color, bg } = getEventStyle(ev.type);
const isSelected = selectedEvent?.id === ev.id;
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
    onDragStart={ev.source === "job" ? (e) => { e.stopPropagation(); handleDragStart(e, events.find((j) => j.id === ev.id)!); } : undefined}
    onClick={(e) => {
      e.stopPropagation();
      if (!isDraggingRef.current && ev.source === "job") {
        const original = events.find((j) => j.id === ev.id);
        if (original) selectEvent(original);
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
```

Also update the `renderTimeGrid` function signature to use `unifiedEvents`:

Find inside `renderTimeGrid` the line that reads events for a date. It currently does `filteredEvents.filter((e) => e.date === dateStr)`. Replace with `unifiedEvents.filter((e) => e.date === dateStr)`.

And update the `layoutEvents` call — it now receives `UnifiedEvent[]` which is already the correct type.

- [ ] **Step 3: Update the month view event pills**

Find the month-view event pill rendering (around line 1181–1190):

```tsx
{dayEvents.slice(0, 2).map((ev) => (
  <div
    key={ev.id}
    onClick={(e) => { e.stopPropagation(); selectEvent(ev); }}
    className="text-[9px] leading-tight text-white px-1 py-0.5 rounded mb-0.5 truncate"
    style={{ backgroundColor: ev.is_verified === false ? "#9ca3af" : "#3b82f6" }}
  >
    {ev.title}
  </div>
))}
```

Replace with:

```tsx
{dayEvents.slice(0, 2).map((ev) => {
  const { color, bg } = getEventStyle(ev.type);
  return (
    <div
      key={ev.id}
      onClick={(e) => {
        e.stopPropagation();
        if (ev.source === "job") {
          const original = events.find((j) => j.id === ev.id);
          if (original) selectEvent(original);
        }
      }}
      className="flex items-center gap-0.5 text-[9px] leading-tight px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer"
      style={{ backgroundColor: bg, borderLeft: `2px solid ${color}` }}
    >
      <span className="truncate font-medium" style={{ color }}>{ev.title}</span>
    </div>
  );
})}
```

Also update `const dayEvents = filteredEvents.filter(...)` to `const dayEvents = unifiedEvents.filter(...)` inside the month-view block.

- [ ] **Step 4: Update the list view**

In `renderListView`, the first line is `const dateGroups: Record<string, JobEvent[]> = {}`. Change to:

```typescript
const dateGroups: Record<string, UnifiedEvent[]> = {};
for (const ev of unifiedEvents) {
```

And update all `JobEvent` references in `renderListView` to `UnifiedEvent`. Update the colored dot:

```tsx
<div
  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
  style={{ backgroundColor: getEventStyle(ev.type).color }}
/>
```

Update the click handler in the list view:

```tsx
onClick={() => {
  if (ev.source !== "job") return;
  const original = events.find((j) => j.id === ev.id);
  if (original) isSelected ? closePanel() : selectEvent(original);
}}
```

Update the title row — plan events won't have a "Draft" badge; only draft-job type does:

```tsx
{ev.type === "draft-job" && (
  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Draft</span>
)}
```

For plan events, show the event type label instead of client/assigned info:

```tsx
{ev.source === "plan" ? (
  <span className="text-xs text-gray-400 capitalize">{ALL_TYPE_CONFIGS[ev.type]?.label}</span>
) : (
  <>
    {ev.client && <span className="text-xs text-gray-400">· {ev.client}</span>}
    {ev.assigned_to && <span className="text-xs text-gray-400">· {ev.assigned_to}</span>}
  </>
)}
```

- [ ] **Step 5: Final TypeScript check**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npx tsc --noEmit 2>&1 | head -40
```

Fix any remaining type errors before proceeding. Common ones:
- `layoutEvents` called with old `JobEvent[]` somewhere → replace with `UnifiedEvent[]`
- `ev.is_verified` referenced on a `UnifiedEvent` where a `.is_verified` check was missed → use `ev.type === "draft-job"` instead

- [ ] **Step 6: Full manual verification**

Start dev server:

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && npm run dev
```

Navigate to `http://localhost:3000/admin/calendar` and verify each item:

1. **Overlay:** Create a Meeting in My Plan tab for today → switch to Schedule tab → meeting appears in purple on the calendar
2. **Colors:** Jobs = orange, Draft jobs = gray, Meeting = purple, Site Visit = burnt orange, Task = green, Reminder = amber, Note = blue
3. **Event cards:** Left border + tinted background + type icon visible in week and day views
4. **Month view:** Colored pills with left border tint
5. **List view:** Colored dots, type label for plan events
6. **Type toggles:** Toggle off "Meetings" → meeting disappears from calendar in real time
7. **Quick Add + Job:** Opens job modal
8. **Quick Add + Task:** Opens PlanEventModal pre-set to Task type, saving creates a green task on the calendar
9. **Employee filter:** Works as before (only affects jobs)
10. **Status filter:** All/Active/Draft works as before
11. **Sidebar collapse:** Collapses to icon rail, calendar expands
12. **Drag-and-drop:** Jobs still draggable; plan events cannot be dragged
13. **Details panel:** Clicking a job opens the side panel; clicking a plan event does nothing
14. **My Plan tab:** Still works correctly (edit/delete plan events)

- [ ] **Step 7: Commit**

```bash
cd "/Users/austinsalt/Desktop/TallyCrew project/TallyCrew code" && git add src/app/admin/calendar/page.tsx && git commit -m "feat: update Schedule tab event cards with type colors, icons, and unified rendering"
```

---

## Self-Review

**Spec coverage check:**
- ✅ My Plan events overlaid on Schedule tab (Tasks 4, 5, 7)
- ✅ Orange for jobs (Task 7 — `getEventStyle("job")` returns `#F4A823`)
- ✅ Distinct color per event type (Tasks 1, 7)
- ✅ Tinted background + left border + type icon on week/day cards (Task 7, Step 2)
- ✅ Month view: dot/pill + title (Task 7, Step 3)
- ✅ Collapsible sidebar with legend/toggles (Task 4)
- ✅ Quick Add in sidebar: job opens existing modal, plan types open PlanEventModal (Tasks 2, 4, 6)
- ✅ Filters moved into sidebar (Tasks 4, 6, Step 3)
- ✅ Type toggles filter calendar in real time (Tasks 5, 4)
- ✅ Draft jobs remain gray and separately toggleable (Task 1 constants, Task 5)
- ✅ Plan events not draggable (Task 7, Step 2)
- ✅ My Plan tab unaffected — uses same PlanEventModal now (Task 3)
- ✅ Employee side (TodaySchedule, DashboardView) unchanged — no regression

**No placeholders:** all steps include actual code.

**Type consistency:** `UnifiedEvent` defined in Task 5, consumed in Tasks 5 and 7. `layoutEvents` updated to `UnifiedEvent[]` in Task 5. `ALL_TYPE_CONFIGS` defined in Task 1, used in Tasks 4 and 7. `PlanEvent` defined in Task 1, used in Tasks 2, 3, 5.
