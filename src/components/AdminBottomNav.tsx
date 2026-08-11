"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const tabs = [
  {
    href: "/admin/home",
    label: "Dashboard",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0A1172" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/admin/dashboard",
    label: "Logs",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0A1172" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    href: "/admin/calendar",
    label: "Calendar",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0A1172" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

const moreItems = [
  {
    href: "/admin/log-config",
    label: "Log Types",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
        <path d="M16 2l4 4-8 8H8v-4l8-8z" />
      </svg>
    ),
  },
  {
    href: "/admin/workers",
    label: "Workers",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/invoices",
    label: "Invoices",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: "/admin/payroll",
    label: "Payroll",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10" />
        <path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2.2 3 2.5c1.7.3 3 1.1 3 2.5s-1.3 2.5-3 2.5-3-1.1-3-2.5" />
      </svg>
    ),
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    href: "/",
    label: "Employee Site",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function AdminBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  async function signOut() {
    const supabase = createSupabaseBrowser();
    const { clearUser } = await import("@/lib/notifications");
    await clearUser().catch(console.error);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {moreOpen && (
        <div className="print:hidden fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
      )}

      {/* More panel — slides up from bottom */}
      <div
        className="print:hidden fixed right-0 z-40 bg-white border-l border-t border-gray-200 rounded-tl-2xl shadow-xl transition-transform duration-300 ease-out"
        style={{ bottom: "52px", transform: moreOpen ? "translateY(0)" : "translateY(calc(100% + 52px))" }}
      >
        {moreItems.map((item, i) => (
          <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
            className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 ${i === 0 ? "rounded-tl-2xl" : ""}`}>
            {item.icon}
            <span className="text-gray-800 font-medium text-sm whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
        <div className="mx-5 border-t border-gray-100" />
        <button onClick={signOut}
          className="flex w-full items-center gap-3 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="text-red-500 font-medium text-sm whitespace-nowrap">Sign Out</span>
        </button>
      </div>

      {/* Bottom nav bar */}
      <nav className="print:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-200 flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors">
              <div className={`p-1.5 rounded-xl transition-colors ${active ? "bg-navy-50" : ""}`}>
                {tab.icon(active)}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-navy-600" : "text-gray-400"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        >
          <div className={`p-1.5 rounded-xl transition-colors ${moreOpen ? "bg-navy-50" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={moreOpen ? "#0A1172" : "#9ca3af"} stroke="none">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </div>
          <span className={`text-[10px] font-semibold tracking-wide ${moreOpen ? "text-navy-600" : "text-gray-400"}`}>More</span>
        </button>
      </nav>
    </>
  );
}
