"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import BottomNav from "@/components/BottomNav";
import DesktopHeader from "@/components/DesktopHeader";

type Section = "profile" | "general";

interface ProfileData {
  email: string;
  fullName: string;
  role: string;
  companyName: string;
  companyId: string;
  memberSince: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        type="button"
        onClick={onBack}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    </div>
  );
}

function NavRow({
  icon,
  iconBg,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M4 2l5 5-5 5" />
      </svg>
    </button>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  // fileInputRef kept here for future use if employee-accessible uploads are added
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role, company_id, created_at")
        .eq("id", user.id)
        .single();
      if (!profileData) { setLoading(false); return; }

      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profileData.company_id)
        .single();

      setProfile({
        email: user.email ?? "",
        fullName: profileData.full_name,
        role: profileData.role,
        companyName: company?.name ?? "—",
        companyId: profileData.company_id,
        memberSince: new Date(profileData.created_at).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        }),
      });
      setLoading(false);
    }
    load();
  }, []);

  // ── Section: Profile ──────────────────────────────────────────────────────
  if (activeSection === "profile") {
    return (
      <div className="min-h-screen bg-gray-50">
        <DesktopHeader />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-28">
          <BackHeader title="Profile" onBack={() => setActiveSection(null)} />
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !profile ? (
            <p className="text-sm text-red-500">Could not load profile.</p>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#F4A823" }}>Account</p>
                <Field label="Name" value={profile.fullName} />
                <Field label="Email" value={profile.email} />
                <Field label="Member since" value={profile.memberSince} />
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Role</p>
                  <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                    profile.role === "admin" ? "bg-navy-100 text-navy-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#F4A823" }}>Company</p>
                <Field label="Company name" value={profile.companyName} />
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Section: General ──────────────────────────────────────────────────────
  if (activeSection === "general") {
    return (
      <div className="min-h-screen bg-gray-50">
        <DesktopHeader />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-28">
          <BackHeader title="General" onBack={() => setActiveSection(null)} />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-400">More options coming soon.</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Home: section list ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopHeader />
      <div className="max-w-lg mx-auto px-4 pt-6 pb-28">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <NavRow
              iconBg="#0A1172"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              }
              label="Profile"
              description="Name, email, role"
              onClick={() => setActiveSection("profile")}
            />
            <div className="mx-4 border-t border-gray-100" />
            <NavRow
              iconBg="#6b7280"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              }
              label="General"
              description="App preferences"
              onClick={() => setActiveSection("general")}
            />
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
