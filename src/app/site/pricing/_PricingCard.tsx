"use client";

import { REGISTER_URL } from "../_lib/constants";
import { PLAN_TIER_ORDER, PLAN_TIERS } from "@/lib/pricingTiers";

const INCLUDED = [
  "Unlimited custom log types",
  "Siri Shortcuts voice logging",
  "Visual scheduling calendar",
  "Client invoicing",
  "iOS & Android app",
];

export default function PricingCard() {
  return (
    <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto items-stretch">
      {PLAN_TIER_ORDER.map((key) => {
        const tier = PLAN_TIERS[key];
        const isFeatured = key === "team";
        return (
          <div
            key={key}
            className={`flex flex-col bg-white rounded-2xl p-8 shadow-sm ${
              isFeatured ? "border-2 border-navy-600 shadow-lg" : "border border-gray-200"
            }`}
          >
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">{tier.name}</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-gray-900">${tier.priceMonthly}</span>
              <span className="text-gray-400 text-sm">/ month</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              {tier.workerLimit === 1 ? "You + 1 worker" : `Up to ${tier.workerLimit} workers`}
            </p>

            <a
              href={REGISTER_URL}
              className={`block font-semibold rounded-xl py-3.5 text-center transition-colors mb-6 ${
                isFeatured
                  ? "bg-navy-600 hover:bg-navy-700 text-white"
                  : "bg-navy-50 hover:bg-navy-100 text-navy-700"
              }`}
            >
              Start 14-Day Free Trial
            </a>

            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-gray-600 font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
                </svg>
                {tier.workerLimit === 1 ? "1 worker" : `Up to ${tier.workerLimit} workers`}
              </li>
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="md:col-span-3 text-center text-xs text-gray-400 mt-1">
        No credit card required to start your trial.
      </p>
    </div>
  );
}
