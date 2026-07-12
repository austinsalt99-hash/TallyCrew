# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skill Mode

By default — skip ALL skill invocations (brainstorming, systematic-debugging, verification-before-completion, etc.) and respond or act directly.

If a message starts with `big:` — use the full skills workflow (brainstorming, planning, verification, etc.) for that request.

## Commands

```bash
npm run dev       # Start local dev server (http://localhost:3000)
npm run build     # Production build
npm run lint      # ESLint check
npx tsc --noEmit  # TypeScript type check (no test suite exists)
```

**Important:** The `.next` build cache frequently corrupts on this machine (likely due to OneDrive syncing interference). If the dev server throws `ENOENT: no such file or directory` errors referencing `.next/server/...` files, delete the folder and restart:
```bash
rm -rf .next && npm run dev
```

## Architecture

### User surfaces
- **`/`** — Employee timesheet form. Employees fill in daily hours and submit. Has a `BottomNav` with tabs for the form, `/schedule` (today's job schedule), `/profile`, and `/settings`.
- **`/admin`** — Admin area with `AdminBottomNav`. Tabs: Dashboard (view/manage submissions), Calendar (schedule jobs), Log Config (custom entry types), Workers, Invoices.
- **`/login`**, **`/register`**, **`/register/join`** — Auth and onboarding flows.

### Auth (Supabase sessions)
Auth is Supabase session-based, not a custom JWT. The middleware (`src/middleware.ts`) refreshes the session on every request and enforces:
- Unauthenticated users → redirect to `/login` (except `/api/` routes and `/login`, `/register`)
- `/admin` routes require `profile.role === "admin"` — workers are redirected to `/`
- Logged-in users hitting login/register → redirect to their home based on role

All admin API routes call `createSupabaseServer()` + `getSessionUser()`, then check `profile.role !== "admin"`. All data is scoped to `profile.company_id`.

### Supabase clients — use the right one
- `src/lib/supabase-server.ts` — for Server Components and API route handlers. Exports `createSupabaseServer()` and `getSessionUser()`.
- `src/lib/supabase-browser.ts` — for Client Components (`"use client"`). Call `createSupabaseBrowser()`.
- `src/lib/supabase.ts` — legacy singleton (`getSupabase()`). Avoid for new code.

`getSessionUser(supabase)` returns `{ user, profile }` where `profile` includes `id`, `company_id`, `full_name`, `role`, `is_dev`.

### Supabase tables
- `submissions` — employee timesheets. `billable_entries` and `non_billable_entries` are JSONB arrays.
- `profiles` — one row per user; has `company_id`, `role` (`"admin"` | `"worker"`), `is_dev`.
- `job_events` — admin-created calendar entries.
- `log_entry_types` / `log_entry_fields` / `log_entry_field_options` — custom log type config.

### Multi-tenant scoping
Every company has its own `company_id`. All queries must scope to `profile.company_id` — never query across companies. Admin endpoints verify `company_id` ownership before any write or delete.

### JSONB containment — critical gotcha
To query inside a JSONB array column (e.g. `billable_entries`), **do not use `.contains()`** — that emits PostgreSQL array syntax `{...}` which fails on JSONB. Use:
```typescript
.filter("billable_entries", "cs", JSON.stringify([{ linkedEventId: eventId }]))
```

### BillableEntry dual format
`BillableEntryData` in `src/components/BillableEntry.tsx` exists in two formats stored in `submissions.billable_entries`:

- **New format** (submissions after the tab-strip redesign): `subEntries: SubEntry[]` is present (may be empty `[]`). General fields (`client`, `description`, `startTime`, `endTime`, `manualHours`) are top-level. Each `SubEntry` has `{ id, slug, customFields?, startTime?, endTime?, manualHours? }`.
- **Old format** (earlier submissions): `subEntries` is absent. Active type stored in `entryType` + top-level `customFields`. Other types saved as snapshots in `_typeData: Record<slug, TypeSnapshot>`.

**Detection:** `entry.subEntries != null` → new format. Both the admin dashboard `getWorkItems()` and the admin calendar `getDisplayItems()` handle both paths.

### Custom log entry types
Admins configure types (e.g. "Trucking", "Machine Operating") with typed fields. `LogEntryType` (see `src/types/logConfig.ts`) has:
- `is_active` — visible to employees
- `is_timed` — whether time fields appear
- `time_mode: "job" | "day" | "none"` — controls time field rendering in `BillableEntry`

The employee form fetches `GET /api/log-config` on mount and passes the result to each `BillableEntry`. Field values are stored in `customFields: Record<string, string>`.

### Data flow on submission
Employee submits → `POST /api/submit` → inserts into `submissions` → fetches log type config to resolve field labels → sends HTML email via Resend.

Admin can link an employee's billable entry to a calendar job via `PATCH /api/submissions` (scoped by `company_id`, not `user_id`).

### SQL migrations
Run `supabase-schema.sql` in the Supabase SQL Editor. This single file contains the complete schema — all tables, RLS policies, helper functions, and storage bucket setup. No other migration files needed.

### Styling conventions
Tailwind CSS only, no component library.
- Blue (`blue-600`) for billable/admin elements, orange (`orange-500`) for non-billable.
- Cards: `bg-white rounded-xl border border-gray-200`
- Primary buttons: `bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl`
- Section labels: `text-xs font-semibold text-{color}-600 uppercase tracking-wide`

### Environment variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
RESEND_API_KEY
RECIPIENT_EMAIL
ANTHROPIC_API_KEY
ADMIN_PASSWORD
JWT_SECRET
```
