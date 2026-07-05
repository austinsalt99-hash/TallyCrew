"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import BottomNav from "@/components/BottomNav";
import DesktopHeader from "@/components/DesktopHeader";

interface ProfileData {
  email: string;
  fullName: string;
  role: string;
  companyName: string;
  memberSince: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, company_id, created_at")
        .eq("id", user.id)
        .single();
      if (!profile) return;

      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single();

      setData({
        email: user.email ?? "",
        fullName: profile.full_name,
        role: profile.role,
        companyName: company?.name ?? "—",
        memberSince: new Date(profile.created_at).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        }),
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopHeader />
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#F4A823" }}>Account</p>
              <Field label="Name" value={data.fullName} />
              <Field label="Email" value={data.email} />
              <Field label="Member since" value={data.memberSince} />
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Role</p>
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  data.role === "admin"
                    ? "bg-navy-100 text-navy-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {data.role.charAt(0).toUpperCase() + data.role.slice(1)}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#F4A823" }}>Company</p>
              <Field label="Company name" value={data.companyName} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-red-500">Could not load profile.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
