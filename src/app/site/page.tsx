import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { REGISTER_URL, LOGIN_URL } from "./_lib/constants";
import StoreButton from "./_components/StoreButton";

const REASONS = [
  {
    t: "Are your employees tracking details in the notes?",
    b: "Writing everything into a plain notes box gets messy fast, and details get forgotten. That means time and money quietly slipping through the cracks. TallyCrew's custom log inputs give your crew a quick, consistent way to log the details of their day instead.",
    href: "/demo#log-types",
    linkLabel: "See how it works",
  },
  {
    t: "Still building invoices by hand?",
    b: "TallyCrew links a rate to every log type up front, so the pricing is already built in. Simply select a job and create the invoice automatically.",
  },
];

const btnGhost =
  "inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-ink text-ink px-6 py-[15px] transition-colors hover:bg-ink hover:text-paper active:translate-y-px";

const h2Class =
  "font-display font-semibold text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[20ch]";

// Shared row inside a feature's <figure> — a label/value line, optionally
// marked as the "current" step with a clay dot (matches the original
// hand-built voice-logging figure this pattern was lifted from).
function FigureRow({ label, value, highlight = false }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-between gap-3 font-label text-[.82rem] py-2.5 ${
        highlight ? "text-ink pl-4" : "text-ink/55"
      }`}
    >
      {highlight && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-clay rounded-[1px]" />}
      <span>{label}</span>
      {value && <span className={highlight ? "" : "text-ink/40"}>{value}</span>}
    </div>
  );
}

function Figure({ heading, rows }: { heading: string; rows: { label: string; value?: string; highlight?: boolean }[] }) {
  return (
    <figure className="border border-hairline rounded-[3px] bg-paper p-[clamp(1.125rem,3vw,1.625rem)]">
      <div className="font-display font-medium text-[1.02rem] leading-[1.45] pb-[18px] border-b border-hairline">
        {heading}
      </div>
      <div className="mt-[18px]">
        {rows.map((row, i) => (
          <div key={row.label}>
            <FigureRow {...row} />
            {i < rows.length - 1 && <div className="h-px bg-hairline" />}
          </div>
        ))}
      </div>
    </figure>
  );
}

// One detailed feature section — moved here from the old standalone
// /features page (which now just redirects to #features) and restyled to
// match this page's look instead of that page's gray/blue card style.
function FeatureDetail({
  id,
  eyebrow,
  title,
  body,
  visual,
  actions,
  reverse = false,
  bg = "paper",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
  actions?: ReactNode;
  reverse?: boolean;
  bg?: "paper" | "sand";
}) {
  return (
    <section id={id} className={`scroll-mt-20 border-t border-hairline ${bg === "sand" ? "bg-sand" : "bg-paper"}`}>
      <div className="max-w-6xl mx-auto px-5 py-[clamp(4rem,12vh,8rem)] grid grid-cols-1 md:grid-cols-2 gap-[clamp(1.75rem,6vw,4.75rem)] items-center">
        <div className={reverse ? "md:order-2" : ""}>
          <p className="font-label text-[.7rem] uppercase tracking-[0.16em] text-ink/55 mb-3.5">{eyebrow}</p>
          <h2 className={h2Class}>{title}</h2>
          <p className="mt-4 text-ink/60 max-w-[56ch] text-[1.05rem] leading-relaxed">{body}</p>
          {actions}
        </div>
        <div className={reverse ? "md:order-1" : ""}>{visual}</div>
      </div>
    </section>
  );
}

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[86dvh] grid grid-rows-[1fr_auto_1fr_auto] justify-items-center text-center px-5 pt-10 pb-[clamp(2.5rem,8vh,5rem)]">
        <div aria-hidden className="pointer-events-none absolute inset-[18px] rounded-[3px] border border-ink/15" />

        <div className="row-start-2 grid justify-items-center gap-[clamp(1.25rem,3.5vw,2.375rem)] w-full">
          <Image
            src="/tally-wordmark-transparent.png"
            alt="TallyCrew"
            width={584}
            height={136}
            priority
            className="w-[min(400px,74vw)] h-auto animate-logo-in"
          />
          <div className="grid justify-items-center gap-3.5">
            <h1 className="font-display font-semibold text-[clamp(1.3rem,2.7vw,2rem)] leading-[1.12] tracking-[-0.02em] text-ink/60 max-w-[24ch] text-balance">
              The timesheet your crew will actually use.
            </h1>
            <p className="font-label text-xs uppercase tracking-[0.22em] text-ink/50">
              simple and effective
            </p>
          </div>
        </div>

        <div className="row-start-4 grid justify-items-center gap-4 w-full max-w-[540px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
            <a href="#why" className={btnGhost}>Why choose TallyCrew</a>
            <a href="#features" className={btnGhost}>View features</a>
          </div>
          <StoreButton className="inline-flex items-center justify-center font-display font-semibold text-base rounded-[3px] bg-ink text-paper px-9 py-4 w-full transition-colors hover:bg-ink/85 active:translate-y-px" />
        </div>
      </section>

      {/* Why choose TallyCrew — each reason numbered on its own, not the section */}
      <section id="why" className="scroll-mt-20 border-t border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-[clamp(4rem,12vh,8rem)]">
          <h2 className={h2Class}>Why choose TallyCrew?</h2>
          <ul className="mt-10 border-t border-hairline">
            {REASONS.map((r, i) => (
              <li
                key={r.t}
                className="py-8 border-b border-hairline grid grid-cols-1 md:grid-cols-[64px_1fr] gap-3 md:gap-6"
              >
                <div className="font-label font-semibold text-[1.3rem] text-clay">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-[1.15rem]">{r.t}</h3>
                  <div className="mt-3 bg-clay/[0.07] border border-clay/20 rounded-[3px] p-5 sm:p-6">
                    <p className="text-ink/80 text-[1rem] leading-relaxed max-w-[60ch]">{r.b}</p>
                    {r.href && (
                      <Link
                        href={r.href}
                        className="mt-4 inline-flex items-center gap-1 font-display font-semibold text-[.92rem] text-clay hover:text-ink transition-colors"
                      >
                        {r.linkLabel} <span aria-hidden>→</span>
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features — moved here from the old standalone /features page */}
      <section id="features" className="scroll-mt-20 border-t border-hairline">
        <div className="max-w-6xl mx-auto px-5 pt-14 md:pt-20 pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <h2 className={h2Class}>Features</h2>
          <Link href="/demo" className={`${btnGhost} shrink-0`}>
            Try the live demo
          </Link>
        </div>
      </section>

      <FeatureDetail
        eyebrow="Voice input"
        title="Add jobs to calendar without picking up your phone."
        body="Say what needs to go on the calendar the same way you'd tell the foreman. TallyCrew turns it into a draft, flagged until an admin signs off. No unlocking your phone, no typing, no job forgotten because nobody wrote it down. It runs on Siri, so it works hands-free right out of the box, no extra app to open."
        bg="sand"
        actions={
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/demo#siri"
              className="inline-flex items-center gap-1 font-display font-semibold text-[.92rem] text-clay hover:text-ink transition-colors"
            >
              Try this feature <span aria-hidden>→</span>
            </Link>
            <Link
              href="/help#siri-calendar"
              className="font-display text-[.85rem] text-ink/45 hover:text-ink/70 underline decoration-ink/20 underline-offset-4 transition-colors"
            >
              Having issues with Siri to calendar?
            </Link>
          </div>
        }
        visual={
          <Figure
            heading={'“Add to my TallyCrew calendar: pour the footings at the Halvorsen lot tomorrow at seven.”'}
            rows={[
              { label: "Parsed on the phone" },
              { label: "Lands as a draft on the calendar" },
              { label: "Admin reviews and approves", highlight: true },
            ]}
          />
        }
      />

      <FeatureDetail
        eyebrow="Crew board"
        title="See everyone's schedule, and move jobs between them in a drag."
        body="One shared calendar the whole crew can see, plus a crew board with one row per worker. Drag a job out of one row and drop it into another to reassign it in seconds. No phone calls, no guessing who's free."
        reverse
        visual={
          <Figure
            heading="Tuesday"
            rows={[
              { label: "Mike R.", value: "Halvorsen lot" },
              { label: "Dana K.", value: "Miller Residence", highlight: true },
              { label: "Josh T.", value: "Open" },
            ]}
          />
        }
      />

      <FeatureDetail
        eyebrow="Custom log types"
        title="Configure fields for exactly how your trade bills."
        body="Every company's work looks different. Build named log types, Trucking, Machine Operating, General Labor, anything, each with its own fields. Set whether a type is timed per job or per day, and price it per hour or per unit."
        bg="sand"
        visual={
          <Figure
            heading="Trucking"
            rows={[
              { label: "Truck #", value: "Dropdown" },
              { label: "Load Type", value: "Dropdown" },
              { label: "Loads Hauled", value: "$12.00 per unit", highlight: true },
            ]}
          />
        }
      />

      <FeatureDetail
        eyebrow="Auto invoices"
        title="Logged hours become an invoice automatically."
        body="Once hours are approved, generate a client invoice straight from what was actually logged, labor, trucking, equipment, whatever line items apply, instead of re-keying numbers into separate software."
        reverse
        visual={
          <Figure
            heading="Approved hours → Invoice #1042"
            rows={[
              { label: "Labor — 7.5h", value: "$375.00" },
              { label: "Trucking — 3 loads", value: "$36.00" },
              { label: "Total", value: "$411.00", highlight: true },
            ]}
          />
        }
      />

      <FeatureDetail
        eyebrow="For owners too"
        title="Bosses can log their own hours right alongside the crew."
        body="Running the company doesn't lock you out of the timesheet. Admins fill out their own day the same way the crew does, so hours you actually work on the tools still show up in reporting and invoicing instead of going untracked."
        bg="sand"
        visual={
          <Figure
            heading="Submitted by: You (Admin)"
            rows={[
              { label: "General labor", value: "6.0h" },
              { label: "+ Trucking", value: "2 loads", highlight: true },
            ]}
          />
        }
      />

      {/* Closing CTA */}
      <section className="bg-navy-600 text-white text-center border-t border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-[clamp(4rem,12vh,8rem)]">
          <Image
            src="/tally-wordmark-transparent.png"
            alt="TallyCrew"
            width={584}
            height={136}
            className="w-[184px] h-auto mx-auto mb-6"
          />
          <h2 className="font-display font-semibold text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-white max-w-[18ch] mx-auto">
            Get your crew off paper this week.
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full max-w-[900px] mx-auto">
            <a
              href={REGISTER_URL}
              className="inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-paper bg-paper text-navy-600 px-6 py-[15px] transition-colors hover:bg-white active:translate-y-px"
            >
              Start free trial
            </a>
            <a
              href={LOGIN_URL}
              className="inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-white/55 text-white px-6 py-[15px] transition-colors hover:bg-white/10 active:translate-y-px"
            >
              Log in
            </a>
            <StoreButton className="inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-white/55 text-white px-6 py-[15px] transition-colors hover:bg-white/10 active:translate-y-px" />
            <a
              href="/demo"
              className="inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-white/55 text-white px-6 py-[15px] transition-colors hover:bg-white/10 active:translate-y-px"
            >
              Try the live demo
            </a>
          </div>
          <p className="mt-[18px] text-[.82rem] text-white/60">14-day trial. No credit card to start.</p>
        </div>
      </section>
    </>
  );
}
