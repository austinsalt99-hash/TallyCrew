"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

interface AccountProfile {
  id: string;
  full_name: string;
  role: "admin" | "worker";
}

interface AccountsData {
  currentUserId: string;
  profiles: AccountProfile[];
}

export default function DevAccountSwitcher() {
  const [data, setData] = useState<AccountsData | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/dev/accounts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => null);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!data || data.profiles.length <= 1) return null;
  if (Capacitor.isNativePlatform()) return null;

  const current = data.profiles.find((p) => p.id === data.currentUserId);
  const others = data.profiles.filter((p) => p.id !== data.currentUserId);

  async function switchTo(userId: string) {
    setSwitching(true);
    setOpen(false);
    const res = await fetch("/api/dev/switch-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (json.actionLink) {
      window.location.href = json.actionLink;
    } else {
      setSwitching(false);
      alert("Switch failed: " + (json.error ?? "unknown error"));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="flex items-center gap-1.5 text-xs border border-dashed border-purple-400 text-purple-500 rounded-lg px-2.5 py-1 hover:bg-purple-50 transition-colors disabled:opacity-50"
      >
        <span className="font-semibold">DEV</span>
        <span className="text-gray-500">{current?.full_name ?? "…"}</span>
        <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Switch to</div>
          {others.map((p) => (
            <button
              key={p.id}
              onClick={() => switchTo(p.id)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  p.role === "admin" ? "bg-navy-100 text-navy-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {p.role}
              </span>
              {p.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
