"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import SiriToken from "@/lib/siriPlugin";
import type { PayPeriodType } from "@/lib/payPeriod";

const PAY_PERIOD_OPTIONS: { value: PayPeriodType; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semimonthly", label: "Twice a month (1st–15th, 16th–end)" },
  { value: "monthly", label: "Monthly" },
];

type Section = "profile" | "general" | "appearance" | "siri" | "notifications";
type UploadStage = "idle" | "cropping" | "uploading";

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

function NavRow({ icon, iconBg, label, description, onClick }: {
  icon: React.ReactNode; iconBg: string; label: string; description: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
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

const BANNER_ASPECT = 3;

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

function initCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 100 }, BANNER_ASPECT, width, height),
    width, height,
  );
}

async function cropImageToBlob(img: HTMLImageElement, px: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  canvas.width = Math.round(px.width * scaleX);
  canvas.height = Math.round(px.height * scaleY);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, px.x * scaleX, px.y * scaleY, px.width * scaleX, px.height * scaleY, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Canvas empty")), "image/jpeg", 0.92);
  });
}

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyTimezone, setCompanyTimezone] = useState("America/Toronto");
  const [tzSaving, setTzSaving] = useState(false);
  const [tzSaved, setTzSaved] = useState(false);
  const [payPeriodType, setPayPeriodType] = useState<PayPeriodType>("biweekly");
  const [payPeriodAnchor, setPayPeriodAnchor] = useState("2024-01-01");
  const [paySaving, setPaySaving] = useState(false);
  const [paySaved, setPaySaved] = useState(false);
  const [morningDigestTime, setMorningDigestTime] = useState("07:00");
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestSaved, setDigestSaved] = useState(false);

  // Siri Shortcuts
  const [siriEnabled, setSiriEnabled] = useState(false);
  const [siriBusy, setSiriBusy] = useState(false);
  const [siriError, setSiriError] = useState<string | null>(null);

  // Crop state
  const [stage, setStage] = useState<UploadStage>("idle");
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profileData } = await supabase
        .from("profiles").select("full_name, role, company_id, created_at, siri_token_hash").eq("id", user.id).single();
      if (!profileData) { setLoading(false); return; }
      setSiriEnabled(!!profileData.siri_token_hash);
      const { data: company } = await supabase
        .from("companies").select("name, banner_url, timezone, pay_period_type, pay_period_anchor, morning_digest_time").eq("id", profileData.company_id).single();
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
      setBannerUrl(company?.banner_url ?? null);
      setCompanyTimezone(company?.timezone ?? "America/Toronto");
      setPayPeriodType((company?.pay_period_type as PayPeriodType) ?? "biweekly");
      setPayPeriodAnchor(company?.pay_period_anchor ?? "2024-01-01");
      setMorningDigestTime(company?.morning_digest_time ?? "07:00");
      setLoading(false);
    }
    load();
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      setSrcUrl(reader.result as string);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setUploadError(null);
      setUploadSuccess(false);
      setStage("cropping");
    };
    reader.readAsDataURL(file);
  }

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(initCrop(width, height));
  }, []);

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

  async function savePaySchedule() {
    setPaySaving(true);
    setPaySaved(false);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pay_period_type: payPeriodType, pay_period_anchor: payPeriodAnchor }),
      });
      if (res.ok) setPaySaved(true);
    } finally {
      setPaySaving(false);
    }
  }

  async function saveMorningDigestTime() {
    setDigestSaving(true);
    setDigestSaved(false);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ morning_digest_time: morningDigestTime }),
      });
      if (res.ok) setDigestSaved(true);
    } finally {
      setDigestSaving(false);
    }
  }

  async function enableSiri() {
    setSiriBusy(true);
    setSiriError(null);
    try {
      const res = await fetch("/api/admin/settings/siri-token", { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to enable Siri Shortcuts");
      await SiriToken.save({ token: json.token });
      setSiriEnabled(true);
    } catch (err) {
      setSiriError(err instanceof Error ? err.message : "Failed to enable Siri Shortcuts");
    } finally {
      setSiriBusy(false);
    }
  }

  async function disableSiri() {
    setSiriBusy(true);
    setSiriError(null);
    try {
      const res = await fetch("/api/admin/settings/siri-token", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disable Siri Shortcuts");
      await SiriToken.clear();
      setSiriEnabled(false);
    } catch (err) {
      setSiriError(err instanceof Error ? err.message : "Failed to disable Siri Shortcuts");
    } finally {
      setSiriBusy(false);
    }
  }

  async function handleUpload() {
    if (!completedCrop || !imgRef.current || !srcUrl) return;
    setStage("uploading");
    setUploadError(null);
    try {
      const blob = await cropImageToBlob(imgRef.current, completedCrop);
      const fd = new FormData();
      fd.append("file", blob, "banner.jpg");
      const res = await fetch("/api/company/banner", { method: "POST", credentials: "include", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setBannerUrl(json.url);
      setUploadSuccess(true);
      setSrcUrl(null);
      setStage("idle");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setStage("cropping");
    }
  }

  function handleCancel() {
    setSrcUrl(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setUploadError(null);
    setStage("idle");
  }

  // ── Section: Profile ──────────────────────────────────────────────────────
  if (activeSection === "profile") {
    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="Profile" onBack={() => setActiveSection(null)} />
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : !profile ? (
          <p className="text-sm text-red-500">Could not load profile.</p>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Account</p>
              <Field label="Name" value={profile.fullName} />
              <Field label="Email" value={profile.email} />
              <Field label="Member since" value={profile.memberSince} />
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Role</p>
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-navy-100 text-navy-700">Admin</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide">Company</p>
              <Field label="Company name" value={profile.companyName} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Section: General ──────────────────────────────────────────────────────
  if (activeSection === "general") {
    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="General" onBack={() => { setTzSaved(false); setActiveSection(null); }} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Company Timezone</p>
            <p className="text-xs text-gray-400">Used to schedule the daily job digest notification (set the exact time under Notifications).</p>
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 mt-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Pay Schedule</p>
            <p className="text-xs text-gray-400">Controls the period boundaries shown on the Payroll page.</p>
          </div>
          <select
            value={payPeriodType}
            onChange={(e) => { setPayPeriodType(e.target.value as PayPeriodType); setPaySaved(false); }}
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAY_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(payPeriodType === "weekly" || payPeriodType === "biweekly") && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">
                Start date of any past pay period — used to line up future {payPeriodType === "weekly" ? "weekly" : "2-week"} periods.
              </p>
              <input
                type="date"
                value={payPeriodAnchor}
                onChange={(e) => { setPayPeriodAnchor(e.target.value); setPaySaved(false); }}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {paySaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="7.5" r="6.5"/><polyline points="4.5,7.5 6.5,9.5 10.5,5.5"/>
              </svg>
              <p className="text-xs text-green-700 font-medium">Pay schedule saved.</p>
            </div>
          )}
          <button
            type="button"
            onClick={savePaySchedule}
            disabled={paySaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {paySaving ? "Saving…" : "Save Pay Schedule"}
          </button>
        </div>
      </div>
    );
  }

  // ── Section: Notifications ────────────────────────────────────────────────
  if (activeSection === "notifications") {
    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="Notifications" onBack={() => { setDigestSaved(false); setActiveSection(null); }} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Morning Digest Time</p>
            <p className="text-xs text-gray-400">
              Each worker gets a push notification listing their jobs for the day, sent at this time
              in your company&apos;s timezone (set under General).
            </p>
          </div>
          <input
            type="time"
            value={morningDigestTime}
            onChange={(e) => { setMorningDigestTime(e.target.value); setDigestSaved(false); }}
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {digestSaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="7.5" r="6.5"/><polyline points="4.5,7.5 6.5,9.5 10.5,5.5"/>
              </svg>
              <p className="text-xs text-green-700 font-medium">Morning digest time saved.</p>
            </div>
          )}
          <button
            type="button"
            onClick={saveMorningDigestTime}
            disabled={digestSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {digestSaving ? "Saving…" : "Save Notification Time"}
          </button>
        </div>
      </div>
    );
  }

  // ── Section: Appearance ───────────────────────────────────────────────────
  if (activeSection === "appearance") {
    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="Appearance" onBack={() => { handleCancel(); setActiveSection(null); }} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Dashboard Banner</p>
            <p className="text-xs text-gray-400">Shown as the background of the employee dashboard header.</p>
          </div>

          {/* ── Idle: pick a photo ── */}
          {stage === "idle" && (
            <>
              {/* Hidden file input — linked by id so the label triggers it reliably */}
              <input
                id="banner-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Entire upload area is a <label> so clicking anywhere opens the picker */}
              <label
                htmlFor="banner-file-input"
                className="block cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-navy-400 hover:bg-navy-50 transition-colors"
                style={{ minHeight: 140 }}
              >
                {bannerUrl ? (
                  <div className="relative" style={{ height: 140 }}>
                    <img src={bannerUrl} alt="Current banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-semibold">Click to replace</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A1172" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Click to upload a banner</p>
                    <p className="text-xs text-gray-400">PNG, JPG or WebP · 1200 × 400 px recommended</p>
                  </div>
                )}
              </label>

              {bannerUrl && (
                <p className="text-xs text-gray-400 text-center">Click the banner above to replace it</p>
              )}

              {uploadSuccess && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.5" cy="7.5" r="6.5"/><polyline points="4.5,7.5 6.5,9.5 10.5,5.5"/>
                  </svg>
                  <p className="text-xs text-green-700 font-medium">Banner updated — employees will see it on their next dashboard load.</p>
                </div>
              )}
            </>
          )}

          {/* ── Crop stage ── */}
          {(stage === "cropping" || stage === "uploading") && srcUrl && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adjust crop</p>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
                <ReactCrop
                  crop={crop}
                  onChange={(_, pct) => setCrop(pct)}
                  onComplete={(px) => setCompletedCrop(px)}
                  aspect={BANNER_ASPECT}
                  className="w-full"
                >
                  <img
                    ref={imgRef}
                    src={srcUrl}
                    alt="Crop preview"
                    onLoad={onImageLoad}
                    className="w-full"
                    style={{ maxHeight: 340, objectFit: "contain" }}
                  />
                </ReactCrop>
              </div>
              <p className="text-xs text-gray-400 text-center">Drag to reposition · Pull corners to resize</p>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-red-600">{uploadError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={stage === "uploading"}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!completedCrop || stage === "uploading"}
                  className="flex-1 py-3 bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {stage === "uploading" ? "Uploading…" : "Apply & Upload"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Section: Siri Shortcuts ───────────────────────────────────────────────
  if (activeSection === "siri") {
    const isNative = Capacitor.isNativePlatform();
    return (
      <div className="max-w-lg mx-auto">
        <BackHeader title="Siri Shortcuts" onBack={() => { setSiriError(null); setActiveSection(null); }} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Add jobs by voice, without opening the app</p>
            <p className="text-xs text-gray-400">
              Once enabled, say “Hey Siri, add to my TallyCrew calendar…” and describe the job the same
              way you would with the Voice button on the calendar page. It’s parsed the same way and
              saved as an unverified draft for you to review in Calendar.
            </p>
          </div>

          {!isNative ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs text-amber-700">Open TallyCrew in the iOS app (not the browser) to enable Siri Shortcuts.</p>
            </div>
          ) : (
            <>
              {siriError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-red-600">{siriError}</p>
                </div>
              )}
              {siriEnabled && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.5" cy="7.5" r="6.5"/><polyline points="4.5,7.5 6.5,9.5 10.5,5.5"/>
                  </svg>
                  <p className="text-xs text-green-700 font-medium">Siri Shortcuts enabled on this phone.</p>
                </div>
              )}
              <button
                type="button"
                onClick={siriEnabled ? disableSiri : enableSiri}
                disabled={siriBusy}
                className={`w-full font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50 ${
                  siriEnabled
                    ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {siriBusy ? "Working…" : siriEnabled ? "Disable on this phone" : "Enable Siri Shortcuts"}
              </button>
              <p className="text-xs text-gray-400">
                Enabling replaces any Siri token from another phone — each admin can have the shortcut active on one device at a time.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Home: section list ────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <NavRow iconBg="#0A1172"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
            label="Profile" description="Name, email, role" onClick={() => setActiveSection("profile")} />
          <div className="mx-4 border-t border-gray-100" />
          <NavRow iconBg="#6b7280"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>}
            label="General" description="App preferences" onClick={() => setActiveSection("general")} />
          <div className="mx-4 border-t border-gray-100" />
          <NavRow iconBg="#F4A823"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
            label="Appearance" description="Dashboard banner, branding" onClick={() => setActiveSection("appearance")} />
          <div className="mx-4 border-t border-gray-100" />
          <NavRow iconBg="#dc2626"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
            label="Notifications" description="Morning digest send time" onClick={() => setActiveSection("notifications")} />
          <div className="mx-4 border-t border-gray-100" />
          <NavRow iconBg="#0A1172"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>}
            label="Siri Shortcuts" description="Add jobs by voice, hands-free" onClick={() => setActiveSection("siri")} />
        </div>
      )}
    </div>
  );
}
