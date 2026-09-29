import Link from "next/link";
import { REGISTER_URL } from "../_lib/constants";
import LogTypesSandbox from "./_components/LogTypesSandbox";
import SiriDemo from "./_components/SiriDemo";

export default function DemoPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-navy-900 to-navy-600 py-14 md:py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">Try TallyCrew, right here</h1>
          <p className="text-navy-100 max-w-lg mx-auto">
            This is a sandbox with sample data — nothing you do here touches a real account. Build a custom log
            type, then log a job with it just like your crew would.
          </p>
        </div>
      </section>

      {/* Custom log types — full width, admin + crew side by side */}
      <section id="log-types" className="w-full py-14 md:py-16 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-5">
          <LogTypesSandbox />
        </div>
      </section>

      {/* Siri */}
      <section id="siri" className="bg-gray-50 border-t border-gray-200 py-14 md:py-16 scroll-mt-20">
        <div className="max-w-2xl mx-auto px-5">
          <SiriDemo />
        </div>
      </section>

      <section className="bg-gray-50 border-t border-gray-200 py-16 text-center">
        <div className="max-w-xl mx-auto px-5">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Like what you see?</h2>
          <p className="text-gray-500 mb-8">Set up your real company and crew in a couple minutes.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={REGISTER_URL} className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors">
              Start Free Trial
            </a>
            <Link href="/#features" className="bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-semibold rounded-xl px-6 py-3.5 transition-colors">
              See All Features
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
