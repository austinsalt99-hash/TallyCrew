"use client";

import { useState } from "react";
import { REGISTER_URL } from "../_lib/constants";

// TODO(pricing): placeholder figures — swap in real numbers before launch.
const MONTHLY_PRICE = 49;
const ANNUAL_PRICE = 470; // billed yearly, ~20% cheaper than monthly

const INCLUDED = [
  "Unlimited crew members",
  "Unlimited custom log types",
  "Siri Shortcuts voice logging",
  "Visual scheduling calendar",
  "Client invoicing",
  "iOS & Android app",
];

export default function PricingCard() {
  const [annual, setAnnual] = useState(true);
  const monthlyEquivalent = annual ? (ANNUAL_PRICE / 12).toFixed(0) : MONTHLY_PRICE;

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-semibold ${!annual ? "text-gray-900" : "text-gray-400"}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((v) => !v)}
          className="w-11 h-6 rounded-full bg-navy-600 flex items-center px-0.5 transition-colors"
        >
          <span
            className={`w-5 h-5 bg-white rounded-full transition-transform ${annual ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
        <span className={`text-sm font-semibold ${annual ? "text-gray-900" : "text-gray-400"}`}>
          Annual <span className="text-green-600">· save ~20%</span>
        </span>
      </div>

      <div className="bg-white rounded-2xl border-2 border-navy-600 shadow-lg p-8">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">TallyCrew</p>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-4xl font-bold text-gray-900">${monthlyEquivalent}</span>
          <span className="text-gray-400 text-sm">/ month</span>
        </div>
        <p className="text-xs text-gray-400 mb-6">
          {annual ? `Billed annually at $${ANNUAL_PRICE}/year` : "Billed monthly, cancel anytime"}
        </p>

        <a
          href={REGISTER_URL}
          className="block bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl py-3.5 text-center transition-colors mb-6"
        >
          Start 14-Day Free Trial
        </a>

        <ul className="space-y-3">
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

      <p className="text-center text-xs text-gray-400 mt-5">No credit card required to start your trial.</p>
    </div>
  );
}
