import type { Metadata } from "next";
import PricingCard from "./_PricingCard";

export const metadata: Metadata = {
  title: "Pricing — TallyCrew",
  description: "One plan, everything included. Try TallyCrew free for 14 days.",
};

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes — every new company gets 14 days free, no credit card required to start.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly plans cancel anytime; annual plans can be cancelled and won't renew at the next billing date.",
  },
  {
    q: "Is there a limit on crew members?",
    a: "No — every plan includes unlimited workers and unlimited custom log types.",
  },
  {
    q: "Do I need a credit card to try it?",
    a: "No. Create your company and start using TallyCrew immediately — you'll only be asked for billing details after the trial.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-gray-50 border-b border-gray-200 py-16 md:py-20 text-center">
        <div className="max-w-2xl mx-auto px-5">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple, all-inclusive pricing</h1>
          <p className="text-gray-500">One plan. Every feature. No per-seat pricing to worry about.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <PricingCard />
      </section>

      <section className="bg-gray-50 border-t border-gray-200 py-16 md:py-20">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-8 text-center">Questions</h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="font-semibold text-gray-900 mb-1.5">{faq.q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
