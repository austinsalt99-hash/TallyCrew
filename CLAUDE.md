# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start local dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
npx tsc --noEmit # TypeScript type check (no test suite exists)
```

**Important:** The `.next` build cache frequently corrupts on this machine (likely due to OneDrive syncing interference). If the dev server throws `ENOENT: no such file or directory` errors referencing `.next/server/...` files, delete the `.next` folder and restart:
```bash
Remove-Item -Recurse -Force .next
npm run dev
```

## Architecture

### Two distinct user surfaces
- **`/`** — Employee timesheet form. No auth. Employees fill in hours and submit for the day.
- **`/admin`** — Admin area. Password-protected via a custom JWT stored in `localStorage`.

### Data flow on submission
Employee submits form → `POST /api/submit` → inserts row into Supabase `submissions` table → fetches log type config from Supabase to resolve field labels → sends HTML email via Resend.

### Auth system (`src/lib/auth.ts`)
Homegrown JWT (no library). The token is a base64url-encoded `header.payload.signature` string, signed with `JWT_SECRET`. It expires after 12 hours and is stored in `localStorage` as `tallycrew-admin-token`. All admin API routes verify the Bearer token using `verifyToken()` before writing. The admin login page posts to `POST /api/admin/login`, which compares the submitted password against `ADMIN_PASSWORD` env var.

### Supabase usage
- Client is a lazy singleton in `src/lib/supabase.ts` — always call `getSupabase()`, never instantiate directly.
- RLS is enabled on all tables. Public tables allow anon SELECT; writes are permitted via anon key but gated at the API route level by JWT checks.
- No server-side auth with Supabase; the anon key is used for all DB operations.

### Custom log entry types
Admins can define custom billable entry types (e.g. "Trucking") with configurable fields. Three tables: `log_entry_types` → `log_entry_fields` → `log_entry_field_options`. Types have `is_active` (visible to employees) and `is_timed` (whether start/end time fields appear). The employee form fetches `GET /api/log-config` on mount and passes the result down to each `BillableEntry` component. Field values are stored as `customFields: Record<string, string>` in the JSONB `billable_entries` column alongside the existing `client`/`description` fields (which are left blank for custom type entries).

### Supabase tables
- `submissions` — employee timesheets; `billable_entries` and `non_billable_entries` are JSONB arrays.
- `job_events` — admin-created calendar entries; public read, admin write.
- `log_entry_types` / `log_entry_fields` / `log_entry_field_options` — log type configuration; public read, admin write.

### SQL migrations (run in Supabase SQL Editor in order)
1. `supabase-schema.sql` — submissions table
2. `supabase-events-schema.sql` — job_events table
3. `supabase-log-config-schema.sql` — log type config tables
4. `supabase-log-config-is-timed.sql` — adds `is_timed` column

### Styling conventions
- Tailwind CSS only, no component library.
- Blue (`blue-600`) for billable/admin elements, orange (`orange-500`) for non-billable, green for schedule/calendar.
- Cards use `bg-white rounded-xl border border-gray-200`.
- Primary buttons: `bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl`.
- Section labels: `text-xs font-semibold text-{color}-600 uppercase tracking-wide`.

### Environment variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
RESEND_API_KEY
RECIPIENT_EMAIL
ADMIN_PASSWORD
JWT_SECRET
```
