"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Hours",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
        <path d="M16 2l4 4-8 8H8v-4l8-8z" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563eb" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
          >
            {tab.icon(active)}
            <span className={`text-xs font-semibold ${active ? "text-blue-600" : "text-gray-400"}`}>
              {tab.label}
            </span>
            {active && (
              <span className="absolute bottom-0 w-12 h-0.5 bg-blue-600 rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
