"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { PLAN_TIERS, isPlanTierKey } from "@/lib/pricingTiers";

interface Props {
  /** Set for companies already on the new tier system; null for legacy/grandfathered accounts. */
  planTier: string | null;
}

const FEATURES = [
  "Unlimited employee timesheets",
  "Custom log entry types",
  "Invoice generation",
  "Job calendar & scheduling",
  "Voice-powered log entry",
  "Push notifications",
];

export default function BillingClient({ planTier }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isNative = Capacitor.isNativePlatform();

  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function startCheckout(body: Record<string, string>) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (isNative) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-5">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={160} height={44} priority />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription required</h1>
          <p className="text-sm text-gray-500 mt-3">
            Your company&apos;s subscription isn&apos;t active right now.
          </p>
          <button
            onClick={signOut}
            className="mt-6 text-sm text-gray-500 underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const tier = isPlanTierKey(planTier) ? PLAN_TIERS[planTier] : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={160} height={44} priority />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {tier ? "Resume your subscription" : "Start your free trial"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tier ? "Your subscription lapsed. Resume it to regain access." : "14 days free, then choose a plan. Cancel anytime."}
          </p>
        </div>

        {tier ? (
          <div className="rounded-2xl border-2 border-blue-600 bg-blue-50 p-4 mb-6">
            <span className="font-semibold text-gray-900">{tier.name}</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ${tier.priceMonthly}
              <span className="text-base font-normal text-gray-500">/mo</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tier.workerLimit === 1 ? "You + 1 worker" : `Up to ${tier.workerLimit} workers`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {/* Annual plan */}
            <button
              onClick={() => setSelected("annual")}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${
                selected === "annual"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">Annual</span>
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      SAVE 20%
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Billed once a year</p>
                </div>
                <div
                  className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected === "annual" ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  }`}
                >
                  {selected === "annual" && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>

            {/* Monthly plan */}
            <button
              onClick={() => setSelected("monthly")}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-colors ${
                selected === "monthly"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold text-gray-900">Monthly</span>
                  <p className="text-sm text-gray-500 mt-1">Billed every month</p>
                </div>
                <div
                  className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected === "monthly" ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  }`}
                >
                  {selected === "monthly" && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">{error}</p>
        )}

        <button
          onClick={() => (tier ? startCheckout({ tier: tier.key }) : startCheckout({ plan: selected }))}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3.5 transition-colors disabled:opacity-50 text-base"
        >
          {loading ? "Redirecting…" : tier ? "Resume subscription" : "Start 14-day free trial"}
        </button>

        {!tier && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Have a promo code? Enter it on the next screen.
          </p>
        )}

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">What&apos;s included</p>
          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
