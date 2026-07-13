# Mobile UI Optimization Design

**Date:** 2026-07-12  
**Status:** Approved  
**Scope:** Admin side (primary) — employee side specific changes deferred to a follow-up pass

---

## Problem

TallyCrew works well on desktop but has a poor mobile experience on the admin side. The core issues are:

1. The admin calendar drag-and-drop is **completely non-functional** on touch screens (uses native HTML5 `dataTransfer` which touch events do not fire)
2. Data pages (Workers, Invoices, Submissions log) use wide grid/table layouts that overflow on small screens
3. Form inputs and action buttons lack adequate touch target sizes (min 44px)
4. Some layouts use fixed horizontal arrangements that don't reflow on narrow viewports

The employee side has minor issues that will be addressed in a separate pass once the admin side is complete.

---

## Constraint

**Desktop experience must not change.** No routing changes, no layout splits, no user-agent detection. The Tailwind `md:` breakpoint (768px) is the architectural boundary — `md:` classes govern desktop, unprefixed classes govern mobile.

---

## Section 1 — Core Architecture Principle

Every CSS change in this project follows one rule: **mobile is the default, desktop is `md:`-prefixed.**

- `block md:hidden` — mobile only
- `hidden md:block` — desktop only
- `flex-col md:flex-row` — stacks on mobile, side-by-side on desktop

This makes desktop regressions structurally impossible. No new routing, no JS-based breakpoint detection, no user-agent sniffing.

---

## Section 2 — Admin Calendar: @dnd-kit Migration

**File:** `src/app/admin/calendar/components/CrewBoard.tsx`

### Problem
Native HTML5 `draggable` / `dataTransfer` events do not fire on touch screens. The entire drag-and-drop system is silently broken on mobile.

### Solution
Replace HTML5 drag events with `@dnd-kit/core`, which supports both `MouseSensor` (desktop) and `TouchSensor` (mobile) through the same API.

### Dependencies to install
```
@dnd-kit/core
@dnd-kit/utilities
```

### Implementation
- Wrap the board's JSX in `<DndContext onDragEnd={handleDragEnd}>` with sensors configured:
  ```ts
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  ```
  The 250ms delay prevents accidental drags when the user is scrolling the grid.
- Each job card element becomes a `<Draggable id={ev.id}>` wrapper. Job cards get `touch-action: none` — required by @dnd-kit to prevent the browser intercepting the gesture.
- Each worker/day cell becomes a `<Droppable id={cellKey}>` where `cellKey` is `"date|workerName"` (same format as the existing `dragOverCell` state).
- The existing `handleDrop(dateStr, workerName, e)` logic (API save) is adapted into `onDragEnd({ active, over })` — extracts date and worker from `over.id`, calls the same save logic. **No data layer changes.**
- Remove: `draggable`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop`, `draggingId` state, `dragOverCell` state, `dragSavingRef` — all replaced by @dnd-kit equivalents.
- The `<DragOverlay>` component renders a ghost of the dragging card on both mouse and touch.

### Mobile grid scrollability
The outer grid container gets `overflow-x-auto` with `-webkit-overflow-scrolling: touch` so admins can swipe horizontally to see all workers and days. The grid's minimum column width is preserved so it doesn't compress.

### Desktop behavior
`MouseSensor` with no activation constraint replicates the immediate-on-mousedown behavior of the current native drag. The experience on desktop is identical.

---

## Section 3 — Admin Data Pages

### 3a. Workers Page (`src/app/admin/workers/page.tsx`)

**Current:** `grid-cols-[1fr_auto_auto]` per worker row — three columns across. Cramped on mobile.

**Mobile:** Each worker becomes a card:
```
┌─────────────────────────────────┐
│ John Smith          Employee    │
│ $22.50/hr  ←tap to edit wage   │
│ Joined Mar 12, 2025             │
└─────────────────────────────────┘
```
- Name and role on the first line
- Wage (tap-to-edit) and join date below
- The existing `WageCell` inline-edit component is reused as-is inside the card

**Desktop:** `grid-cols-[1fr_auto_auto]` layout unchanged, hidden on mobile via `hidden md:grid`.

**Invite codes section:** Already a simple list. Needs `gap-3` and full-width code display on mobile. No structural change.

### 3b. Admin Submissions Log (`src/app/admin/dashboard/page.tsx`)

**Current:** Already uses a card/accordion pattern per submission — largely mobile-friendly. The issues are:
- The filter row at the top has a hardcoded `w-48` on the name input and fixed-size date input side by side — too wide on mobile
- Inner expanded content uses `flex items-center gap-2` rows that can overflow on narrow screens

**Mobile:** Filter inputs stack vertically (`flex-col`), each taking full width. Inner expanded entry rows wrap gracefully via `flex-wrap` (already present in some places, needs to be consistent). No structural change to the card layout itself.

**Desktop:** Unchanged.

### 3c. Invoices List (`src/app/admin/invoices/page.tsx`)

**Current:** Table/grid of invoices.

**Mobile:** Each invoice becomes a card:
```
┌─────────────────────────────────┐
│ Acme Corp                 Draft │
│ $1,240.00          Jul 10, 2026 │
└─────────────────────────────────┘
```
Status badge aligned right. Tap target is the full card.

**Desktop:** Unchanged.

---

## Section 4 — Admin Forms and Utility Pages

Applies to: Log Config (`/admin/log-config`), Settings (`/admin/settings`), Billing (`/admin/billing`), Profile (`/admin/profile`), Admin Home announcement form.

### Touch targets
All `<input>`, `<select>`, `<textarea>` elements get `min-h-[44px]`. Buttons that are currently small/icon-only get padding or a minimum tap area.

### Layout
- Side-by-side button rows: `flex-col md:flex-row` with `w-full md:w-auto` on buttons
- Form containers: reduce horizontal padding on mobile (`px-4 md:px-6`)
- Section headers with action buttons: stack on mobile (`flex-col md:flex-row items-start md:items-center`)

### Admin Home announcement form
The "Post Announcement" form currently renders inline. On mobile it gets full-width inputs and a bottom-anchored submit button that stays visible while typing (avoids keyboard covering it).

---

## Out of Scope

- Employee side changes (deferred — user will specify separately)
- Calendar views other than CrewBoard (AvailabilityGrid, WorkloadView, MyPlanView) — assessed as lower priority; can be addressed in a follow-up
- Offline queuing / PWA features (separate project)
- Any new features — this is purely a mobile responsiveness pass

---

## Success Criteria

1. All admin pages are usable on a 390px-wide screen (iPhone 14) with no horizontal overflow
2. Drag-and-drop on the CrewBoard works on touch (verified on iOS Safari and Android Chrome)
3. All interactive elements have ≥44px touch targets
4. Desktop at ≥768px is pixel-identical to before these changes
5. No TypeScript errors introduced
