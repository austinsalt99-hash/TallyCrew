"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

// Names for the sections people tap into. Anything not listed falls back to the last path segment.
const SECTION_NAMES: Record<string, string> = {
  "/": "Timesheet",
  "/dashboard": "Dashboard",
  "/schedule": "Schedule",
  "/profile": "Profile",
  "/settings": "Settings",
  "/time-off": "Time off",
  "/admin/home": "Home",
  "/admin/dashboard": "Dashboard",
  "/admin/calendar": "Calendar",
  "/admin/timesheet": "Timesheet",
  "/admin/log-config": "Log config",
  "/admin/workers": "Workers",
  "/admin/invoices": "Invoices",
  "/admin/payroll": "Payroll",
  "/admin/financials": "Financials",
  "/admin/settings": "Settings",
  "/admin/billing": "Billing",
};

function sectionName(pathname: string): string {
  if (SECTION_NAMES[pathname]) return SECTION_NAMES[pathname];
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return last ? last.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase()) : "This section";
}

// The path isn't known until the browser has the page, since this page is prerendered
// and the server never sees which section was requested. The server snapshot covers
// the prerendered HTML, and the browser snapshot fills in the name after hydration.
const noSubscribe = () => () => {};
const readName = () => sectionName(window.location.pathname);
const serverName = () => "This section";

export default function OfflineFallbackPage() {
  const name = useSyncExternalStore(noSubscribe, readName, serverName);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
      <h1 className="text-xl font-bold text-gray-800">{name} isn&rsquo;t saved on this device</h1>
      <p className="text-gray-500 text-sm max-w-xs">
        You&rsquo;re offline. Sections are saved to this device once you&rsquo;ve opened them while connected.
        Reconnect to load {name.toLowerCase()}.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="border border-gray-300 bg-white text-gray-700 font-semibold rounded-xl px-4 py-2 text-sm"
        >
          Go back
        </button>
        <Link href="/" className="bg-navy-600 text-white font-semibold rounded-xl px-4 py-2 text-sm">
          Home
        </Link>
      </div>
    </div>
  );
}
