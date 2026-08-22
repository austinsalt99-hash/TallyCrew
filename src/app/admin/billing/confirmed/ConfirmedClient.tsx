"use client";

import { useRouter } from "next/navigation";

interface Props {
  companyName: string;
  statusLabel: string;
  isTrialing: boolean;
  nextBillingDate: string | null;
}

export default function ConfirmedClient({
  companyName,
  statusLabel,
  isTrialing,
  nextBillingDate,
}: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">You&apos;re subscribed</h1>
        <p className="text-sm text-gray-500 mb-6">
          {companyName ? `${companyName} is` : "Your account is"} all set on TallyCrew.
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Current plan
          </p>
          <p className="text-base font-semibold text-gray-900 mb-1">{statusLabel}</p>
          {nextBillingDate && (
            <p className="text-sm text-gray-500">
              {isTrialing ? "Trial ends" : "Next billing date"}:{" "}
              <span className="font-medium text-gray-700">{nextBillingDate}</span>
              {isTrialing && " — no charge until then."}
            </p>
          )}
        </div>

        <button
          onClick={() => router.push("/admin")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
