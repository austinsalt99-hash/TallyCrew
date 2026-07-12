# Schedule Tab Sidebar Redesign & My Plan Overlay

**Date:** 2026-07-11  
**Status:** Approved for implementation

---

## Context

The Schedule tab (admin calendar) currently shows only `job_events` with a binary color system: blue for active jobs, gray for AI-drafted jobs. The My Plan tab shows the admin's personal events (meetings, site visits, tasks, reminders, notes) with distinct colors, but those events are invisible when looking at the Schedule tab.

The goal is to:
1. Overlay My Plan events onto the Schedule calendar so everything is visible in one place
2. Introduce a meaningful color system based on event type (not status)
3. Add a redesigned left sidebar with event type legend/toggles, quick-add, and filters
4. Match the orange color that employees already see for job events

---

## Color System

| Type | Color | Background Tint | Used For |
|------|-------|----------------|----------|
| Job | #F4A823 (orange) | #FFF8EC | `job_events` (matches employee view) |
| Meeting | #7c3aed (purple) | #ede9fe | My Plan - meeting |
| Site Visit | #ea580c (burnt orange) | #ffedd5 | My Plan - site-visit |
| Task | #16a34a (green) | #dcfce7 | My Plan - task |
| Reminder | #d97706 (amber) | #fef3c7 | My Plan - reminder |
| Note | #2563eb (blue) | #dbeafe | My Plan - note |
| Draft Job | #9ca3af (gray) | #f3f4f6 | Unverified/AI-drafted job_events |

> Note: Job orange (#F4A823) and Site Visit burnt orange (#ea580c) are visually distinct enough shades; the legend clarifies any ambiguity.

---

## Architecture

### Data Flow

1. The Schedule tab currently fetches `job_events` via `GET /api/events?from=&to=`
2. Add a second fetch to `GET /api/admin/plan-events?from=&to=` (already exists, used by `MyPlanView.tsx` line 175)
3. Merge into a `UnifiedEvent[]` array:

```typescript
interface UnifiedEvent {
  id: string;
  source: "job" | "plan";
  type: JobEventType | PlanEventType; // "job" | "draft-job" | "meeting" | "site-visit" | "task" | "reminder" | "note"
  date: string;
  title: string;
  start_time?: string;
  end_time?: string;
  // job-specific
  client?: string;
  location?: string;
  assigned_to?: string;
  is_verified?: boolean;
  // plan-specific
  description?: string;
}
```

4. Filter by active type toggles before rendering

### Toggle State

A `visibleTypes` set (stored in `useState`) controls which event types render:
```typescript
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
  new Set(["job", "draft-job", "meeting", "site-visit", "task", "reminder", "note"])
);
```
All types visible by default. Toggling removes/adds from the set.

### New Component: `ScheduleSidebar`

File: `src/app/admin/calendar/components/ScheduleSidebar.tsx`

Props:
- `visibleTypes: Set<string>`
- `onToggleType: (type: string) => void`
- `employeeFilter: string`
- `onEmployeeFilterChange: (v: string) => void`
- `statusFilter: "all" | "verified" | "unverified"`
- `onStatusFilterChange: (v) => void`
- `workers: string[]`
- `onQuickAdd: (type: string) => void`
- `isCollapsed: boolean`
- `onToggleCollapse: () => void`

---

## UI Sections

### Left Sidebar

**Collapsed state:** thin icon rail (32px wide), showing colored dots for each type  
**Expanded state:** ~220px wide panel

```
┌─────────────────────────────────┐
│  [← Collapse]                   │
│                                 │
│  EVENT TYPES                    │
│  ●  Jobs              [  ●  ]  │  orange
│  ●  Meetings          [  ●  ]  │  purple
│  ●  Site Visits       [  ●  ]  │  burnt orange
│  ●  Tasks             [  ●  ]  │  green
│  ●  Reminders         [  ●  ]  │  amber
│  ●  Notes             [  ●  ]  │  blue
│  ●  Draft Jobs        [  ●  ]  │  gray
│                                 │
│  QUICK ADD                      │
│  + Job                          │
│  + Meeting                      │
│  + Site Visit                   │
│  + Task                         │
│  + Reminder                     │
│  + Note                         │
│                                 │
│  FILTERS                        │
│  Employee: [All ▼]              │
│  Status:   [All] [Active] [Draft]│
└─────────────────────────────────┘
```

The existing top filter bar (employee dropdown + All/Active/Drafts buttons) moves into the sidebar and is removed from the top of the calendar.

### Event Cards (Week & Day View)

Each event block uses:
- **Background:** light tint of the type color (see Color System table)
- **Left border:** 4px solid, full type color
- **Small type icon** (top-left, 12px): briefcase (job), calendar (meeting), map-pin (site visit), check-square (task), bell (reminder), file-text (note)
- **Title** (bold, dark text, truncated)
- **Time range** (muted, small, below title)
- **Client/location** (jobs only, muted, if block height > 48px)

### Event Cards (Month View)

Compact pill/dot + title only. Color dot indicates type. No icons on month view.

### Quick Add Behavior

Clicking any Quick Add button:
- **"+ Job"** → opens the existing new-job modal (same as clicking "+" in header today)
- **"+ Meeting / Site Visit / Task / Reminder / Note"** → opens the My Plan event creation modal with that type pre-selected (the same modal used in the My Plan tab, triggered from the Schedule tab)

No new modal UI needed — reuse existing modals.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/admin/calendar/page.tsx` | Add second fetch for my-plan-events; build `UnifiedEvent[]`; add `visibleTypes` state; move filter state into sidebar props; render `<ScheduleSidebar>` left of calendar |
| `src/app/admin/calendar/components/ScheduleSidebar.tsx` | **New file** — sidebar component with legend/toggles, quick add, filters |
| `src/app/admin/calendar/page.tsx` (event rendering) | Update event block rendering to use `UnifiedEvent` color/icon/tint logic |
| `src/app/admin/calendar/components/MyPlanView.tsx` | Extract `EVENT_TYPES` map to a shared location so both Schedule and MyPlan can import it |

Shared constant to extract:
- `src/app/admin/calendar/constants/eventTypes.ts` — exports `EVENT_TYPES` record (currently defined in `MyPlanView.tsx` lines 7–13)

---

## Verification

1. **Dev server:** Start `npm run dev`, navigate to `/admin/calendar` → Schedule tab
2. **Overlay check:** Create a Meeting in My Plan for today → confirm it appears on Schedule tab calendar in purple
3. **Toggle test:** Toggle off "Meetings" in sidebar → meeting disappears from calendar in real time
4. **Quick Add:** Click "+ Task" in sidebar → My Plan modal opens with Task pre-selected
5. **Filters in sidebar:** Change employee filter → calendar updates the same as before
6. **Color check:** Jobs are orange, drafts are gray, each plan type is its correct color
7. **Month/week/day views:** All three views render the overlay events correctly
8. **Collapse:** Sidebar collapses to icon rail; calendar expands to fill space
9. **Employee side:** No regression on employee dashboard (TodaySchedule, DashboardView) — those already use orange and don't show My Plan events
