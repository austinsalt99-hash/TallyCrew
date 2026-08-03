import Link from "next/link";
import PhoneFrame from "./_components/mockups/PhoneFrame";
import TimesheetMockup from "./_components/mockups/TimesheetMockup";
import SiriMockup from "./_components/mockups/SiriMockup";
import LogTypeBuilderMockup from "./_components/mockups/LogTypeBuilderMockup";
import CalendarMockup from "./_components/mockups/CalendarMockup";
import { REGISTER_URL } from "./_lib/constants";

const FEATURES = [
  {
    title: "Voice-powered logging",
    body: "“Hey Siri, add to my TallyCrew calendar…” Crew leads log jobs hands-free, right from the truck.",
    icon: "mic",
  },
  {
    title: "Custom job types",
    body: "Trucking, machine operating, general labor — build the exact fields your trade needs, with per-hour or per-unit rates.",
    icon: "layers",
  },
  {
    title: "Visual scheduling",
    body: "Drag and drop jobs onto a shared calendar so every crew member knows where to be.",
    icon: "calendar",
  },
  {
    title: "Instant invoicing",
    body: "Logged hours turn into client invoices automatically — no re-entering numbers.",
    icon: "invoice",
  },
  {
    title: "Native mobile app",
    body: "iOS and Android apps built for job sites — fast, offline-friendly, and always in your pocket.",
    icon: "phone",
  },
  {
    title: "Built for teams",
    body: "Multi-company support, worker roles, and an admin dashboard that scopes everything correctly.",
    icon: "team",
  },
];

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-900 via-navy-700 to-navy-600">
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="text-xs font-semibold text-white/80">Built for trades &amp; field crews</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight">
              Timesheets built for crews, not spreadsheets.
            </h1>
            <p className="text-navy-100 text-lg mt-5 max-w-md">
              Voice-powered job logging, custom field types for any trade, and a schedule your whole crew can see — all in one app.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/site/demo"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-3.5 text-center transition-colors"
              >
                Try the Live Demo
              </Link>
              <a
                href={REGISTER_URL}
                className="bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl px-6 py-3.5 text-center border border-white/20 transition-colors"
              >
                Start Free Trial
              </a>
            </div>
            <p className="text-navy-300 text-xs mt-4">14-day free trial · No credit card required</p>
          </div>

          <div className="hidden md:block">
            <PhoneFrame>
              <TimesheetMockup />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <div className="max-w-xl mb-12">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Everything in one app</p>
          <h2 className="font-display text-3xl font-bold text-gray-900">
            From the job site to the invoice, without switching apps.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <FeatureIcon name={f.icon} />
              </div>
              <p className="font-semibold text-gray-900 mb-1.5">{f.title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Deep dive: Siri */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Siri Shortcuts</p>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Add a job without taking your gloves off.
            </h3>
            <p className="text-gray-500 leading-relaxed mb-6">
              Say what needs to happen and TallyCrew turns it into a draft job on the calendar — parsed automatically, ready for
              an admin to review. No typing, no app-switching, no missed jobs because someone forgot to write it down.
            </p>
            <Link href="/site/features#siri" className="text-blue-600 font-semibold text-sm hover:underline">
              See how voice logging works &rarr;
            </Link>
          </div>
          <SiriMockup />
        </div>
      </section>

      {/* Deep dive: Custom log types */}
      <section className="max-w-6xl mx-auto px-5 py-20 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <LogTypeBuilderMockup />
        </div>
        <div className="order-1 md:order-2">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Custom Log Types</p>
          <h3 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Not every job is billed by the hour.
          </h3>
          <p className="text-gray-500 leading-relaxed mb-6">
            Build a field set for exactly how your trade works — truck numbers, load counts, machine hours, mileage —
            each priced per hour or per unit. Every company&apos;s config is their own.
          </p>
          <Link href="/site/features#log-types" className="text-blue-600 font-semibold text-sm hover:underline">
            See how custom types work &rarr;
          </Link>
        </div>
      </section>

      {/* Deep dive: Calendar */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Scheduling</p>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              One calendar the whole crew can see.
            </h3>
            <p className="text-gray-500 leading-relaxed mb-6">
              Drag jobs onto the schedule, link them to logged hours, and keep drafts from Siri separate until an admin
              verifies them. Everyone always knows where they&apos;re headed.
            </p>
            <Link href="/site/features#calendar" className="text-blue-600 font-semibold text-sm hover:underline">
              See how scheduling works &rarr;
            </Link>
          </div>
          <CalendarMockup />
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-5 py-20 md:py-28 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Get your crew off paper timesheets.
        </h2>
        <p className="text-gray-500 max-w-lg mx-auto mb-8">
          Try TallyCrew free for 14 days, or take the interactive demo for a spin — no account needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={REGISTER_URL}
            className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors"
          >
            Start Free Trial
          </a>
          <Link
            href="/site/demo"
            className="bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-semibold rounded-xl px-6 py-3.5 transition-colors"
          >
            Try the Live Demo
          </Link>
        </div>
      </section>
    </>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "#2563eb", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "mic":
      return <svg {...common}><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 11a7 7 0 01-14 0M12 18v4"/></svg>;
    case "layers":
      return <svg {...common}><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case "invoice":
      return <svg {...common}><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h3"/></svg>;
    case "phone":
      return <svg {...common}><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>;
    default:
      return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
  }
}
