# Push Notifications Design

**Date:** 2026-07-12
**Status:** Approved

## Overview

Add push notifications to TallyCrew's Capacitor mobile app using OneSignal. Two notification types:
1. **Morning digest** — sent at 7:00 AM company local time, lists today's assigned jobs for each employee
2. **Announcement push** — sent immediately when an admin posts an announcement

The system is intentionally extensible: all OneSignal interactions are centralized in two modules (`src/lib/notifications.ts` on the client, `src/lib/onesignal.ts` on the server), so future notification types only need to call those helpers.

**OneSignal App ID:** `51c3cc2e-c7a0-432e-b977-4ad3629113d6`

---

## Data Layer

### Supabase schema change

Add a `timezone` column to the `companies` table:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Toronto';
```

No other schema changes. OneSignal stores all device tokens on their side — we do not need a `device_tokens` table. We use:
- **External User ID** = Supabase `user.id` (for per-user targeting)
- **Tag** `company_id` = `profile.company_id` (for company-wide targeting)

### New env vars

```
# Public — used by the client-side Capacitor plugin (NEXT_PUBLIC_ prefix required for Next.js)
NEXT_PUBLIC_ONESIGNAL_APP_ID=51c3cc2e-c7a0-432e-b977-4ad3629113d6

# Server-only — used by onesignal.ts REST calls and the cron route
ONESIGNAL_APP_ID=51c3cc2e-c7a0-432e-b977-4ad3629113d6
ONESIGNAL_REST_API_KEY=<from OneSignal dashboard → Settings → Keys & IDs → REST API Key>
CRON_SECRET=<any random string — used to authenticate Vercel cron requests>
```

---

## Client Side — `src/lib/notifications.ts`

Single file, three exported functions. All calls are guarded by `Capacitor.isNativePlatform()` so the web version is unaffected.

```
initNotifications()
  - Called once on app mount
  - Initializes OneSignal with NEXT_PUBLIC_ONESIGNAL_APP_ID
  - Requests push permission from the OS

identifyUser(userId: string, companyId: string)
  - Called after successful login
  - Sets OneSignal external user ID = userId
  - Sets OneSignal tag company_id = companyId
  - Links device to this specific employee and company

clearUser()
  - Called on logout
  - Removes external user ID and tags
  - Prevents shared-device bleed
```

**Where to call these:**
- `initNotifications()` → root layout (`src/app/layout.tsx`) inside a `useEffect`, native-only
- `identifyUser()` → `src/app/login/page.tsx` after the `router.push()` on line 39 (role-based redirect)
- `clearUser()` → `src/components/AdminBottomNav.tsx` `signOut()` function on line 111. Employee-side logout does not currently exist; `clearUser()` can be wired up there when it is added.

**Package to install:** `onesignal-capacitor` (OneSignal's official Capacitor plugin)

**Additional env var needed on client:**
```
NEXT_PUBLIC_ONESIGNAL_APP_ID=51c3cc2e-c7a0-432e-b977-4ad3629113d6
```

---

## Server Side — `src/lib/onesignal.ts`

Server-only module. Two functions:

```
sendToUser(externalUserId: string, title: string, body: string): Promise<void>
  - Sends a push notification to a single user by their Supabase user ID
  - Used by the morning digest cron

sendToCompany(companyId: string, title: string, body: string): Promise<void>
  - Sends to all subscribers tagged with company_id = companyId
  - Used by the announcement route
```

Both call the OneSignal REST API (`https://onesignal.com/api/v1/notifications`) with `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`. Errors are logged but do not throw — a failed push should never break the primary DB operation that triggered it.

---

## Morning Digest Cron — `/api/cron/morning-digest`

### Schedule

`vercel.json` at repo root:
```json
{
  "crons": [
    {
      "path": "/api/cron/morning-digest",
      "schedule": "0 * * * *"
    }
  ]
}
```

Runs at the top of every UTC hour. The route itself determines which companies are at 7:00 AM.

### Security

Request must include header `Authorization: Bearer <CRON_SECRET>`. Vercel automatically sends this header when invoking cron routes — you set `CRON_SECRET` in Vercel's environment variables. Any request without the correct secret returns 401.

### Logic

```
1. Fetch all companies (id, timezone)
2. For each company:
   a. Use Intl.DateTimeFormat to get the current hour in company.timezone
   b. Skip if not 7 AM
3. For matching companies:
   a. Fetch all profiles where role = 'worker' AND company_id = company.id
   b. Get today's date string in the company's timezone (YYYY-MM-DD)
   c. Fetch job_events where date = today AND company_id = company.id
   d. For each worker:
      - Filter events where assigned_to.toLowerCase().includes(worker.full_name.toLowerCase())
      - If no events: skip (no notification)
      - If events: build digest message, call sendToUser(worker.id, title, body)
4. Return { ok: true, sent: N }
```

### Notification content

- **Title:** `"Your jobs for today"`
- **Body:** comma-separated list of job titles with times, e.g. `"8:00 AM – Smith Residence, 1:00 PM – Downtown Office"`
- Max ~3 jobs shown inline; if more, "…and 2 more" appended

### Timezone detection

Uses `Intl.DateTimeFormat` with `{ timeZone, hour: 'numeric', hour12: false }` — no extra npm package. Available in Node 18+ (Vercel runtime).

---

## Announcement Push — `/api/announcements` (POST)

After the existing DB insert succeeds, add:

```typescript
await sendToCompany(profile.company_id, data.title, data.body ?? "New announcement");
```

Failure to send the push does not affect the HTTP response — the announcement is already saved.

---

## Company Timezone Setting — `/api/company` (PATCH)

New API route that accepts `{ timezone: string }` and updates `companies.timezone` for the authenticated admin's company.

Admin UI: a timezone dropdown added to the admin settings page. Options are a curated list of common IANA timezones:
- America/St_Johns, America/Halifax, America/Toronto, America/Winnipeg, America/Edmonton, America/Vancouver (Canadian)
- Plus common US and international zones

---

## Extensibility

To add a new notification type in the future:
- **Triggered notifications** (e.g. "your timesheet was approved"): call `sendToUser()` from the relevant API route
- **Scheduled notifications** (e.g. weekly summary): add a new cron route and register it in `vercel.json`
- **Broadcast notifications**: call `sendToCompany()` from any server context

No changes to the core notification modules needed.

---

## iOS Native Setup (Xcode — done once manually)

The OneSignal Capacitor plugin requires these Xcode capabilities enabled:
- Push Notifications
- Background Modes → Remote notifications

APNs auth key (`.p8` file) must be uploaded to OneSignal dashboard under App Settings → Apple iOS.

These are one-time Xcode/Apple Developer steps, not code changes.

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `onesignal-capacitor` |
| `capacitor.config.ts` | No change needed |
| `vercel.json` | New file — cron schedule |
| `src/lib/notifications.ts` | New — client-side OneSignal wrapper |
| `src/lib/onesignal.ts` | New — server-side OneSignal REST helper |
| `src/app/layout.tsx` | Call `initNotifications()` on mount |
| `src/app/login/page.tsx` (or auth handler) | Call `identifyUser()` after login |
| `src/app/api/announcements/route.ts` | Call `sendToCompany()` after insert |
| `src/app/api/cron/morning-digest/route.ts` | New — cron handler |
| `src/app/api/company/route.ts` | New — PATCH timezone |
| `src/app/admin/settings/page.tsx` (or equivalent) | Add timezone picker |
| `supabase-schema.sql` | Add `companies.timezone` column |
| `.env.local` | Add 3 new vars |
