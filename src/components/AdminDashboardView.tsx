"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAVY = "#0A1172";
const NAVY_DARK = "#060b47";
const ORANGE = "#F4A823";

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
}

function greet(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `Good ${part}, ${name.split(" ")[0]}`;
}

export default function AdminDashboardView({ userName }: { userName: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/announcements").then((r) => r.json()),
      fetch("/api/company", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([annData, companyData]) => {
        setAnnouncements(Array.isArray(annData) ? annData : []);
        setBannerUrl(companyData?.banner_url ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handlePost() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null, pinned }),
      });
      if (!res.ok) return;
      const created: Announcement = await res.json();
      setAnnouncements((prev) =>
        pinned ? [created, ...prev] : [created, ...prev]
      );
      setTitle("");
      setBody("");
      setPinned(false);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }
  }

  return (
    <div>

      {/* Header — banner image or gradient fallback, 100vw escapes max-w-5xl and px-4 */}
      <div
        className="px-5 pt-14 md:pt-8 pb-20 relative overflow-hidden"
        style={{
          ...(bannerUrl
            ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: `linear-gradient(155deg, ${NAVY_DARK} 0%, ${ORANGE} 100%)` }),
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginTop: "-2rem",
        }}
      >
        {bannerUrl && (
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,17,114,0.55) 0%, rgba(10,17,114,0.35) 100%)" }} />
        )}
        <div className="relative z-10">
          <p className="text-sm text-white/70 font-medium tracking-wide">{todayLabel}</p>
          <h1 className="text-[26px] font-bold text-white mt-1 leading-tight">{greet(userName)}</h1>
        </div>
      </div>

      {/* Quick access card — sits below header with small gap so banner is visible */}
      <div className="mt-4 bg-white rounded-2xl shadow-xl p-4 relative z-10">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/dashboard"
            className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-2.5 active:bg-gray-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Employee Logs</p>
              <p className="text-xs text-gray-400 mt-0.5">Review submissions</p>
            </div>
          </Link>

          <Link
            href="/admin/calendar"
            className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-2.5 active:bg-gray-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 bg-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Calendar</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage job schedule</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="space-y-5 mt-5">

      {/* Announcements */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Announcements</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: showForm ? "#f3f4f6" : NAVY,
              color: showForm ? "#374151" : "#fff",
            }}
          >
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>

        {/* New announcement form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-3 space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
            />
            <textarea
              placeholder="Body (optional)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setPinned((v) => !v)}
                  className="w-9 h-5 rounded-full transition-colors relative"
                  style={{ backgroundColor: pinned ? ORANGE : "#d1d5db" }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{ transform: pinned ? "translateX(18px)" : "translateX(2px)" }}
                  />
                </div>
                <span className="text-xs text-gray-500 font-medium">Pin to top</span>
              </label>
              <button
                onClick={handlePost}
                disabled={saving || !title.trim()}
                className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: NAVY }}
              >
                {saving ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
            <p className="text-sm font-semibold text-gray-700">No announcements yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Post one to notify your team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {a.pinned && <div className="h-0.5" style={{ backgroundColor: ORANGE }} />}
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {a.pinned && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider mb-1 block"
                        style={{ color: ORANGE }}
                      >
                        Pinned
                      </span>
                    )}
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{a.title}</p>
                    {a.body && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.body}</p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-2">
                      {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      </div>
    </div>
  );
}

