# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OneSignal push notifications to TallyCrew's Capacitor mobile app — a personalized 7am job digest per employee, and an instant push when an admin posts an announcement.

**Architecture:** The client-side `onesignal-capacitor` plugin registers devices and identifies users (external user ID = Supabase user.id, tagged with company_id). A Vercel cron route fires every hour, checks which companies are at 7am in their timezone, and calls the OneSignal REST API per employee. The announcements API route triggers company-wide pushes on new posts. All OneSignal calls go through two thin modules: `src/lib/notifications.ts` (client) and `src/lib/onesignal.ts` (server).

**Tech Stack:** `onesignal-capacitor` (Capacitor SDK), OneSignal REST API v1, Vercel Cron, Supabase service role key (for cron DB access without user session), Node.js `Intl.DateTimeFormat` for timezone math (no extra package).

## Global Constraints

- All client-side OneSignal calls must be guarded by `Capacitor.isNativePlatform()` — the web version must never break
- OneSignal errors must be caught and logged; they must never propagate and break the primary operation
- `npx tsc --noEmit` must pass after every task
- Tailwind CSS only — match existing card style (`bg-white rounded-2xl border border-gray-200 shadow-sm`)
- Company timezone stored as IANA timezone string (e.g. `"America/Toronto"`)
- OneSignal App ID: `51c3cc2e-c7a0-432e-b977-4ad3629113d6`

---

### Task 1: Install onesignal-capacitor and add env vars

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `TallyCrew code/.env.local`
- Run: `npx cap sync` after install

**Interfaces:**
- Produces: `onesignal-capacitor` importable in Tasks 4 and 5

- [ ] **Step 1: Install the package**

```bash
cd "TallyCrew code" && npm install onesignal-capacitor
```

Expected: package appears in `package.json` dependencies, no peer dep errors.

- [ ] **Step 2: Add env vars to .env.local**

Open `TallyCrew code/.env.local` and add these lines at the bottom:

```
# OneSignal push notifications
NEXT_PUBLIC_ONESIGNAL_APP_ID=51c3cc2e-c7a0-432e-b977-4ad3629113d6
ONESIGNAL_APP_ID=51c3cc2e-c7a0-432e-b977-4ad3629113d6
ONESIGNAL_REST_API_KEY=<paste from OneSignal dashboard → Settings → Keys & IDs → REST API Key>
CRON_SECRET=<generate with: openssl rand -hex 32>

# Supabase service role key (for cron route — bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY=<paste from Supabase dashboard → Project Settings → API → service_role key>
```

**Do not commit `.env.local`.** After deploying, add these five vars to Vercel's environment variables dashboard (Settings → Environment Variables).

- [ ] **Step 3: Sync native projects**

```bash
cd "TallyCrew code" && npx cap sync
```

Expected: iOS and Android native projects updated with the new plugin.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "TallyCrew code" && git add package.json package-lock.json
git commit -m "feat: install onesignal-capacitor"
```

---

### Task 2: Supabase schema migration + vercel.json

**Files:**
- Modify: `TallyCrew code/supabase-schema.sql`
- Create: `TallyCrew code/vercel.json`

**Interfaces:**
- Produces: `companies.timezone` column — consumed by Task 7 (cron) and Task 8 (UI)
- Produces: `vercel.json` cron entry — activates the cron route created in Task 7

- [ ] **Step 1: Add timezone column to supabase-schema.sql**

In `supabase-schema.sql`, find the block that creates the `companies` table. Immediately after the `ALTER TABLE companies ENABLE ROW LEVEL SECURITY;` line for companies, add:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Toronto';
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste and run:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Toronto';
```

Expected: query completes without error. Verify by running `SELECT id, name, timezone FROM companies LIMIT 5;` — the `timezone` column appears with value `America/Toronto`.

- [ ] **Step 3: Create vercel.json**

Create `TallyCrew code/vercel.json`:

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

This fires the cron at the top of every UTC hour. The route itself checks which companies are at 7am.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "TallyCrew code" && git add supabase-schema.sql vercel.json
git commit -m "feat: add companies.timezone column and vercel cron config"
```

---

### Task 3: Server-side OneSignal REST helper

**Files:**
- Create: `TallyCrew code/src/lib/onesignal.ts`

**Interfaces:**
- Produces:
  - `sendToUser(externalUserId: string, title: string, body: string): Promise<void>`
  - `sendToCompany(companyId: string, title: string, body: string): Promise<void>`
- Consumed by: Task 6 (announcements route), Task 7 (cron route)

- [ ] **Step 1: Create src/lib/onesignal.ts**

```typescript
const APP_ID = process.env.ONESIGNAL_APP_ID!;
const REST_KEY = process.env.ONESIGNAL_REST_API_KEY!;
const API_URL = "https://onesignal.com/api/v1/notifications";

async function send(payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${REST_KEY}`,
      },
      body: JSON.stringify({ app_id: APP_ID, ...payload }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[OneSignal] send failed:", res.status, text);
    }
  } catch (err) {
    console.error("[OneSignal] send error:", err);
  }
}

export async function sendToUser(
  externalUserId: string,
  title: string,
  body: string
): Promise<void> {
  await send({
    include_external_user_ids: [externalUserId],
    channel_for_external_user_ids: "push",
    headings: { en: title },
    contents: { en: body },
  });
}

export async function sendToCompany(
  companyId: string,
  title: string,
  body: string
): Promise<void> {
  await send({
    filters: [{ field: "tag", key: "company_id", relation: "=", value: companyId }],
    headings: { en: title },
    contents: { en: body },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "TallyCrew code" && git add src/lib/onesignal.ts
git commit -m "feat: add OneSignal server REST helper"
```

---

### Task 4: Client-side notifications wrapper

**Files:**
- Create: `TallyCrew code/src/lib/notifications.ts`

**Interfaces:**
- Produces:
  - `initNotifications(): Promise<void>` — initialize OneSignal SDK, request permission
  - `identifyUser(userId: string, companyId: string): Promise<void>` — link device to user
  - `clearUser(): Promise<void>` — unlink device on logout
- Consumed by: Task 5 (wiring into existing files)

- [ ] **Step 1: Create src/lib/notifications.ts**

```typescript
import { Capacitor } from "@capacitor/core";

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  try {
    const { default: OneSignal } = await import("onesignal-capacitor");
    OneSignal.initialize(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!);
    await OneSignal.Notifications.requestPermission(true);
  } catch (err) {
    console.error("[notifications] init error:", err);
  }
}

export async function identifyUser(userId: string, companyId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { default: OneSignal } = await import("onesignal-capacitor");
    await OneSignal.login(userId);
    OneSignal.User.addTag("company_id", companyId);
  } catch (err) {
    console.error("[notifications] identifyUser error:", err);
  }
}

export async function clearUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { default: OneSignal } = await import("onesignal-capacitor");
    await OneSignal.logout();
  } catch (err) {
    console.error("[notifications] clearUser error:", err);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "TallyCrew code" && git add src/lib/notifications.ts
git commit -m "feat: add client-side OneSignal notifications wrapper"
```

---

### Task 5: Wire notifications into existing files

**Files:**
- Modify: `TallyCrew code/src/lib/capacitor.ts` (add initNotifications)
- Modify: `TallyCrew code/src/app/login/page.tsx` (add identifyUser after login)
- Modify: `TallyCrew code/src/components/AdminBottomNav.tsx` (add clearUser on sign-out)

**Interfaces:**
- Consumes: `initNotifications`, `identifyUser`, `clearUser` from `src/lib/notifications.ts`

- [ ] **Step 1: Add initNotifications to src/lib/capacitor.ts**

The current file is:

```typescript
import { Capacitor } from "@capacitor/core";

export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/keyboard"),
  ]);

  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#ffffff" });

  Keyboard.addListener("keyboardWillShow", () => {
    document.body.style.paddingBottom = "0";
  });
}
```

Replace it with:

```typescript
import { Capacitor } from "@capacitor/core";
import { initNotifications } from "./notifications";

export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/keyboard"),
  ]);

  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#ffffff" });

  Keyboard.addListener("keyboardWillShow", () => {
    document.body.style.paddingBottom = "0";
  });

  await initNotifications();
}
```

- [ ] **Step 2: Add identifyUser to src/app/login/page.tsx**

The login page currently fetches only `role`. Change the select to also fetch `company_id`, then call `identifyUser` after the redirect.

Find this block in `handleSubmit` (around line 33):

```typescript
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    router.push(profile?.role === "admin" ? "/admin/dashboard" : "/");
    router.refresh();
```

Replace it with:

```typescript
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    router.push(profile?.role === "admin" ? "/admin/dashboard" : "/");
    router.refresh();

    if (profile?.company_id) {
      const { identifyUser } = await import("@/lib/notifications");
      identifyUser(user.id, profile.company_id).catch(console.error);
    }
```

- [ ] **Step 3: Add clearUser to src/components/AdminBottomNav.tsx**

Find the `signOut` function (around line 111):

```typescript
  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
```

Replace it with:

```typescript
  async function signOut() {
    const supabase = createSupabaseBrowser();
    const { clearUser } = await import("@/lib/notifications");
    await clearUser().catch(console.error);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "TallyCrew code" && git add src/lib/capacitor.ts src/app/login/page.tsx src/components/AdminBottomNav.tsx
git commit -m "feat: wire OneSignal init, identifyUser, and clearUser into app lifecycle"
```

---

### Task 6: Announcement push notification

**Files:**
- Modify: `TallyCrew code/src/app/api/announcements/route.ts`

**Interfaces:**
- Consumes: `sendToCompany` from `src/lib/onesignal.ts`

- [ ] **Step 1: Add sendToCompany call to POST handler**

Open `src/app/api/announcements/route.ts`. Find the POST handler. The current end of the function (after the successful insert) is:

```typescript
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
```

Replace it with:

```typescript
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { sendToCompany } = await import("@/lib/onesignal");
  sendToCompany(
    profile.company_id,
    data.title,
    data.body ?? "New announcement"
  ).catch(console.error);

  return NextResponse.json(data, { status: 201 });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server (`npm run dev`), log in as admin, post a new announcement. Verify in the OneSignal dashboard (Delivery → Recent) that a push attempt was logged.

- [ ] **Step 4: Commit**

```bash
cd "TallyCrew code" && git add src/app/api/announcements/route.ts
git commit -m "feat: send push notification when admin posts announcement"
```

---

### Task 7: Morning digest cron route

**Files:**
- Create: `TallyCrew code/src/app/api/cron/morning-digest/route.ts`

**Interfaces:**
- Consumes: `sendToUser` from `src/lib/onesignal.ts`
- Consumes: `companies.timezone` column (Task 2), `job_events` table, `profiles` table

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/morning-digest/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendToUser } from "@/lib/onesignal";

function getHourInTimezone(timezone: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
      10
    );
  } catch {
    return -1;
  }
}

function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: companies } = await supabase
    .from("companies")
    .select("id, timezone");

  if (!companies?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const company of companies) {
    const timezone = company.timezone ?? "America/Toronto";

    if (getHourInTimezone(timezone) !== 7) continue;

    const today = getTodayInTimezone(timezone);

    const { data: workers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", company.id)
      .eq("role", "worker");

    if (!workers?.length) continue;

    const { data: events } = await supabase
      .from("job_events")
      .select("title, start_time, assigned_to")
      .eq("company_id", company.id)
      .eq("date", today)
      .order("start_time");

    if (!events?.length) continue;

    for (const worker of workers) {
      if (!worker.full_name) continue;

      const myEvents = events.filter(
        (ev) =>
          ev.assigned_to
            ?.toLowerCase()
            .includes(worker.full_name.toLowerCase())
      );

      if (!myEvents.length) continue;

      const MAX_SHOWN = 3;
      const shown = myEvents.slice(0, MAX_SHOWN);
      const overflow = myEvents.length - MAX_SHOWN;

      const parts = shown.map((ev) => {
        const time = ev.start_time ? `${formatTime(ev.start_time)} – ` : "";
        return `${time}${ev.title}`;
      });
      if (overflow > 0) parts.push(`…and ${overflow} more`);

      await sendToUser(worker.id, "Your jobs for today", parts.join(", "));
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test via curl**

Start the dev server (`npm run dev`). Then run (replace `YOUR_CRON_SECRET` with the value from `.env.local`):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/morning-digest
```

Expected response: `{"ok":true,"sent":0}` (0 is fine if no company is at 7am right now — the route ran successfully).

Verify the route also rejects unauthenticated requests:

```bash
curl http://localhost:3000/api/cron/morning-digest
```

Expected: `{"error":"Unauthorized"}` with 401.

- [ ] **Step 4: Commit**

```bash
cd "TallyCrew code" && git add src/app/api/cron/morning-digest/route.ts
git commit -m "feat: add morning digest cron route"
```

---

### Task 8: Timezone setting — API extension + admin UI

**Files:**
- Modify: `TallyCrew code/src/app/api/company/route.ts` (PATCH + GET)
- Modify: `TallyCrew code/src/app/admin/settings/page.tsx` (timezone picker in General section)

**Interfaces:**
- Consumes: `companies.timezone` column (Task 2)

- [ ] **Step 1: Extend GET /api/company to return timezone**

In `src/app/api/company/route.ts`, change the GET handler's select from `"name, banner_url"` to `"name, banner_url, timezone"`:

```typescript
export async function GET() {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("companies")
    .select("name, banner_url, timezone")
    .eq("id", profile.company_id)
    .single();

  return NextResponse.json(data ?? {});
}
```

- [ ] **Step 2: Extend PATCH /api/company to accept timezone**

Replace the PATCH handler with one that handles both `banner_url` and `timezone` updates:

```typescript
export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.banner_url !== undefined) updates.banner_url = body.banner_url;
  if (body.timezone !== undefined) updates.timezone = body.timezone;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Add timezone state to admin settings page**

In `src/app/admin/settings/page.tsx`, find the existing state declarations near the top of `AdminSettingsPage`:

```typescript
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
```

Add three new state variables immediately after those lines:

```typescript
  const [companyTimezone, setCompanyTimezone] = useState("America/Toronto");
  const [tzSaving, setTzSaving] = useState(false);
  const [tzSaved, setTzSaved] = useState(false);
```

- [ ] **Step 4: Load timezone in useEffect**

In the same file, find this line inside the `load` function in `useEffect`:

```typescript
      const { data: company } = await supabase
        .from("companies").select("name, banner_url").eq("id", profileData.company_id).single();
```

Change it to:

```typescript
      const { data: company } = await supabase
        .from("companies").select("name, banner_url, timezone").eq("id", profileData.company_id).single();
```

Then find where `setBannerUrl` is called:

```typescript
      setBannerUrl(company?.banner_url ?? null);
```

Add the timezone line immediately after it:

```typescript
      setBannerUrl(company?.banner_url ?? null);
      setCompanyTimezone(company?.timezone ?? "America/Toronto");
```

- [ ] **Step 5: Replace General section with timezone picker**

Find the "General" section in `src/app/admin/settings/page.tsx`:

```typescript
  // ── Section: General ──────────────────────────────────────────────────────
  if (activeSection === "general") {
    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="General" onBack={() => setActiveSection(null)} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-400">More options coming soon.</p>
        </div>
      </div>
    );
  }
```

Replace it entirely with:

```typescript
  // ── Section: General ──────────────────────────────────────────────────────
  if (activeSection === "general") {
    const TIMEZONE_OPTIONS = [
      { label: "Newfoundland (NST/NDT)", value: "America/St_Johns" },
      { label: "Atlantic (AST/ADT)", value: "America/Halifax" },
      { label: "Eastern (EST/EDT)", value: "America/Toronto" },
      { label: "Central (CST/CDT)", value: "America/Winnipeg" },
      { label: "Mountain (MST/MDT)", value: "America/Edmonton" },
      { label: "Pacific (PST/PDT)", value: "America/Vancouver" },
      { label: "Alaska (AKST/AKDT)", value: "America/Anchorage" },
      { label: "Hawaii (HST)", value: "Pacific/Honolulu" },
      { label: "Eastern US (EST/EDT)", value: "America/New_York" },
      { label: "Central US (CST/CDT)", value: "America/Chicago" },
      { label: "Mountain US (MST/MDT)", value: "America/Denver" },
      { label: "Pacific US (PST/PDT)", value: "America/Los_Angeles" },
      { label: "UTC", value: "UTC" },
      { label: "London (GMT/BST)", value: "Europe/London" },
      { label: "Paris (CET/CEST)", value: "Europe/Paris" },
      { label: "Dubai (GST)", value: "Asia/Dubai" },
      { label: "Singapore (SGT)", value: "Asia/Singapore" },
      { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
    ];

    async function saveTimezone() {
      setTzSaving(true);
      setTzSaved(false);
      try {
        const res = await fetch("/api/company", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ timezone: companyTimezone }),
        });
        if (res.ok) setTzSaved(true);
      } finally {
        setTzSaving(false);
      }
    }

    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="General" onBack={() => { setTzSaved(false); setActiveSection(null); }} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Company Timezone</p>
            <p className="text-xs text-gray-400">Used to schedule the 7:00 AM daily job digest notification.</p>
          </div>
          <select
            value={companyTimezone}
            onChange={(e) => { setCompanyTimezone(e.target.value); setTzSaved(false); }}
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          {tzSaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="7.5" r="6.5"/><polyline points="4.5,7.5 6.5,9.5 10.5,5.5"/>
              </svg>
              <p className="text-xs text-green-700 font-medium">Timezone saved.</p>
            </div>
          )}
          <button
            type="button"
            onClick={saveTimezone}
            disabled={tzSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {tzSaving ? "Saving…" : "Save Timezone"}
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "TallyCrew code" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual smoke test**

Start the dev server (`npm run dev`). Log in as admin → Settings → General. You should see a timezone dropdown pre-populated with the company's current timezone. Change it and click Save — the green success banner should appear. Refresh and return to General to confirm the saved value persisted.

- [ ] **Step 8: Commit**

```bash
cd "TallyCrew code" && git add src/app/api/company/route.ts src/app/admin/settings/page.tsx
git commit -m "feat: add company timezone setting to admin General settings"
```

---

## iOS Setup Checklist (manual, done once in Xcode)

These steps are required for push notifications to work on iOS. They are not code changes — they happen in Xcode and the Apple/OneSignal dashboards.

- [ ] Open Xcode: `npx cap open ios` from the `TallyCrew code` directory
- [ ] In Xcode, select the TallyCrew target → Signing & Capabilities
- [ ] Click "+ Capability" and add **Push Notifications**
- [ ] Click "+ Capability" and add **Background Modes**, then check **Remote notifications**
- [ ] In the Apple Developer portal, generate an APNs Auth Key (.p8 file) for your App ID
- [ ] In OneSignal dashboard → Settings → Apple iOS → upload the .p8 key

## Post-Deploy Checklist

- [ ] Add all five env vars to Vercel (Settings → Environment Variables): `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Verify the Vercel cron appears in the Vercel dashboard under Settings → Cron Jobs after deploy
- [ ] Test a push end-to-end: install the app on a physical device, log in, post an announcement as admin, confirm notification arrives
