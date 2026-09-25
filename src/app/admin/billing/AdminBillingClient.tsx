"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PLAN_TIER_ORDER, PLAN_TIERS, isPlanTierKey, type PlanTierKey } from "@/lib/pricingTiers";

interface Props {
  companyName: string;
  statusLabel: string;
  subscriptionStatus: string | null;
  nextBillingDate: string | null;
  hasStripeCustomer: boolean;
  planTier: string | null;
}

export default function AdminBillingClient({
  companyName,
  statusLabel,
  subscriptionStatus,
  nextBillingDate,
  hasStripeCustomer,
  planTier,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [changingTier, setChangingTier] = useState<PlanTierKey | null>(null);
  const isNative = Capacitor.isNativePlatform();

  async function changePlan(tier: PlanTierKey) {
    setChangingTier(tier);
    setError("");
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change plan. Please try again.");
        setChangingTier(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not change plan. Please try again.");
    } finally {
      setChangingTier(null);
    }
  }

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open billing portal. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal. Please try again.");
      setLoading(false);
    }
  }

  const isPastDue = subscriptionStatus === "past_due";
  const isTrialing = subscriptionStatus === "trialing";

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Billing</h1>

        {isPastDue && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-orange-800 font-medium">
              Payment failed — please update your billing info below to keep access.
            </p>
          </div>
        )}

        {/* Subscription status card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Current plan
          </p>
          <p className="text-gray-500 text-xs mb-1">{companyName}</p>
          <p className={`text-base font-semibold mb-1 ${isPastDue ? "text-orange-600" : "text-gray-900"}`}>
            {statusLabel}
          </p>
          {nextBillingDate && !isTrialing && (
            <p className="text-sm text-gray-500">
              {subscriptionStatus === "canceled" ? "Access ended" : isPastDue ? "Payment due" : "Next billing date"}:{" "}
              <span className="font-medium text-gray-700">{nextBillingDate}</span>
            </p>
          )}
          {isTrialing && nextBillingDate && (
            <p className="text-sm text-gray-500">
              Trial ends <span className="font-medium text-gray-700">{nextBillingDate}</span> — no charge until then.
            </p>
          )}
        </div>

        {/* Change plan (only for companies on the new tier system) */}
        {isPlanTierKey(planTier) && !isNative && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Change plan</p>
            <div className="space-y-2">
              {PLAN_TIER_ORDER.map((key) => {
                const t = PLAN_TIERS[key];
                const isCurrent = key === planTier;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${
                      isCurrent ? "border-blue-600 bg-blue-50" : "border-gray-200"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {t.name} {isCurrent && <span className="text-xs font-normal text-blue-600">(current)</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.workerLimit === 1 ? "You + 1 worker" : `Up to ${t.workerLimit} workers`} · ${t.priceMonthly}/mo
                      </p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => changePlan(key)}
                        disabled={changingTier !== null}
                        className="text-xs font-semibold text-navy-600 hover:underline disabled:opacity-50"
                      >
                        {changingTier === key ? "Switching…" : "Switch"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isNative ? null : hasStripeCustomer ? (
            <>
              <button
                onClick={openPortal}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
              >
                {loading ? "Opening portal…" : "Manage billing"}
              </button>
              <p className="text-xs text-center text-gray-400">
                Update payment method, view invoices, switch plans, or cancel
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => router.push("/billing")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                Subscribe
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}
