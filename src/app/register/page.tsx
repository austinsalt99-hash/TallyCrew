"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { Capacitor } from "@capacitor/core";
import { PLAN_TIER_ORDER, PLAN_TIERS, type PlanTierKey } from "@/lib/pricingTiers";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [tier, setTier] = useState<PlanTierKey>("team");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // The iOS/Android app must not offer a way to create a new (paying) company
  // account — App Store Guideline 3.1.1. Bounce straight to sign-in instead
  // of rendering this screen at all.
  useEffect(() => {
    if (isNative) {
      router.replace("/login");
    }
  }, [isNative, router]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.companyName,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        agreedToTerms,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      setLoading(false);
      return;
    }

    // Establish session client-side after the server created the account
    const supabase = createSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (signInError) {
      setError("Account created but sign-in failed. Please go to the login page.");
      setLoading(false);
      return;
    }

    const checkoutRes = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const checkoutData = await checkoutRes.json();
    if (!checkoutRes.ok || !checkoutData.url) {
      setError(checkoutData.error ?? "Account created but checkout failed. Please go to the billing page.");
      setLoading(false);
      router.push("/billing");
      return;
    }

    window.location.href = checkoutData.url;
  };

  if (isNative) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={180} height={50} priority />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your company account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Already have an account?{" "}
            <a href="/login" className="text-navy-600 hover:underline font-medium">
              Sign in
            </a>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={set("companyName")}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="Acme Landscaping"
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your account</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={set("fullName")}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={set("email")}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set("password")}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-navy-400"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Choose your plan</p>
              <div className="space-y-2">
                {PLAN_TIER_ORDER.map((key) => {
                  const t = PLAN_TIERS[key];
                  const selected = tier === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTier(key)}
                      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors flex items-center justify-between ${
                        selected ? "border-navy-600 bg-navy-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                        <p className="text-xs text-gray-500">
                          {t.workerLimit === 1 ? "You + 1 worker" : `Up to ${t.workerLimit} workers`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-gray-900">${t.priceMonthly}/mo</p>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-navy-600 bg-navy-600" : "border-gray-300"
                          }`}
                        >
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">14 days free, then billing starts. Cancel anytime.</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-navy-600 focus:ring-navy-400"
              />
              <span className="text-sm text-gray-600">
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline font-medium">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Employee with an invite code?{" "}
          <a href="/register/join" className="text-navy-600 hover:underline font-medium">
            Join your team
          </a>
        </p>
      </div>
    </div>
  );
}
