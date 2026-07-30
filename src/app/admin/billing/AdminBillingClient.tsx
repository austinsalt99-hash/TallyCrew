"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  companyName: string;
  statusLabel: string;
  subscriptionStatus: string | null;
  nextBillingDate: string | null;
  hasStripeCustomer: boolean;
  showSuccess: boolean;
}

export default function AdminBillingClient({
  companyName,
  statusLabel,
  subscriptionStatus,
  nextBillingDate,
  hasStripeCustomer,
  showSuccess,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not open billing portal. Please try again.");
      setLoading(false);
      return;
    }
    window.location.href = data.url;
  }

  const isPastDue = subscriptionStatus === "past_due";
  const isTrialing = subscriptionStatus === "trialing";

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Billing</h1>

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-sm text-green-800 font-medium">
              You&apos;re all set! Enjoy TallyCrew.
            </p>
          </div>
        )}

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

        {/* Actions */}
        <div className="space-y-3">
          {hasStripeCustomer ? (
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
