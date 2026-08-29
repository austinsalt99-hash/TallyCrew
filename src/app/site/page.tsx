import Image from "next/image";
import { REGISTER_URL } from "./_lib/constants";

const REASONS = [
  {
    t: "It fits how your trade bills.",
    b: "Build the job types you actually run. Trucking by the load, machine time by the hour, general labor. Each one carries its own fields and its own rate.",
  },
  {
    t: "Your crew will actually log it.",
    b: "Add a job by voice from the truck, or tap through a form that only asks what that job needs. It keeps working when there is no signal on site.",
  },
  {
    t: "Hours become invoices on their own.",
    b: "Approved hours turn into client-ready line items. Nobody re-types a paper timesheet into separate software at the end of the month.",
  },
];

const FEATURES = [
  { t: "Voice logging", b: "“Hey Siri, add to my TallyCrew calendar.” Hands-free from the cab." },
  { t: "Custom job types", b: "Fields and rates for every kind of work your company takes on." },
  { t: "Shared schedule", b: "Drag jobs onto one calendar the whole crew can see." },
  { t: "Instant invoicing", b: "Logged hours out, client invoice in. No re-keying numbers." },
  { t: "Built for crews", b: "Roles, multiple companies, and an admin view that keeps it straight." },
  { t: "Works offline", b: "Log on site with no bars. It syncs once you are back in range." },
];

const btnGhost =
  "inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-ink text-ink px-6 py-[15px] transition-colors hover:bg-ink hover:text-paper active:translate-y-px";

const h2Class =
  "font-display font-semibold text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[20ch]";

const secWrap =
  "max-w-6xl mx-auto px-5 py-[clamp(4rem,12vh,8rem)] grid grid-cols-1 md:grid-cols-[92px_1fr] gap-4 md:gap-[clamp(1rem,4vw,3.25rem)]";

const secNum = "font-label font-semibold text-[clamp(1.4rem,2.6vw,1.9rem)] text-clay";

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
            className="w-[min(400px,74vw)] h-auto"
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

        <div className="row-start-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-[540px]">
          <a href="#why" className={btnGhost}>Why choose TallyCrew</a>
          <a href="#features" className={btnGhost}>View features</a>
        </div>
      </section>

      {/* 01 - Why choose TallyCrew */}
      <section id="why" className="scroll-mt-20 border-t border-hairline">
        <div className={secWrap}>
          <div className={secNum}>01</div>
          <div>
            <h2 className={h2Class}>Made for the trades, not the office.</h2>
            <p className="mt-4 text-ink/60 max-w-[56ch] text-[1.05rem] leading-relaxed">
              Most time trackers assume a desk and a nine to five. TallyCrew is built around job sites, trucks, and crews that bill by the load.
            </p>
            <ul className="mt-10 border-t border-hairline">
              {REASONS.map((r) => (
                <li
                  key={r.t}
                  className="py-6 border-b border-hairline grid grid-cols-1 sm:grid-cols-[minmax(0,22ch)_1fr] gap-1.5 sm:gap-[clamp(0.75rem,3vw,2.5rem)]"
                >
                  <h3 className="font-display font-semibold text-[1.05rem]">{r.t}</h3>
                  <p className="text-ink/60 text-[.97rem] leading-relaxed">{r.b}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 02 - Features */}
      <section id="features" className="scroll-mt-20 border-t border-hairline">
        <div className={secWrap}>
          <div className={secNum}>02</div>
          <div>
            <h2 className={h2Class}>Everything the day runs on.</h2>
            <ol className="mt-10 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-[clamp(1.5rem,5vw,4rem)]">
              {FEATURES.map((f, i) => (
                <li key={f.t} className="grid grid-cols-[42px_1fr] gap-3.5 py-5 border-b border-hairline">
                  <span className="font-label text-[.82rem] text-ink/55 pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display font-semibold text-base">{f.t}</h3>
                    <p className="text-ink/60 text-[.92rem] mt-0.5 leading-relaxed">{f.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 03 - In depth: voice logging */}
      <section id="depth" className="bg-sand border-y border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-[clamp(4rem,12vh,8rem)] grid grid-cols-1 md:grid-cols-2 gap-[clamp(1.75rem,6vw,4.75rem)] items-center">
          <div>
            <p className="font-label text-[.7rem] uppercase tracking-[0.16em] text-ink/55 mb-3.5">
              Voice logging
            </p>
            <h2 className={h2Class}>Log a job without taking your gloves off.</h2>
            <p className="mt-4 text-ink/60 max-w-[56ch] text-[1.05rem] leading-relaxed">
              Say what happened the same way you would tell the foreman. TallyCrew turns it into a draft on the calendar, flagged until an admin signs off. No unlocking a phone, no typing, no job forgotten because nobody wrote it down.
            </p>
          </div>
          <figure className="border border-hairline rounded-[3px] bg-paper p-[clamp(1.125rem,3vw,1.625rem)]">
            <div className="font-display font-medium text-[1.02rem] leading-[1.45] pb-[18px] border-b border-hairline">
              &ldquo;Add to my TallyCrew calendar: pour the footings at the Halvorsen lot tomorrow at seven.&rdquo;
            </div>
            <div className="mt-[18px]">
              <div className="font-label text-[.82rem] text-ink/55 py-2.5">Parsed on the phone</div>
              <div className="h-px bg-hairline" />
              <div className="font-label text-[.82rem] text-ink/55 py-2.5">Lands as a draft on the calendar</div>
              <div className="h-px bg-hairline" />
              <div className="relative font-label text-[.82rem] text-ink py-2.5 pl-4">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-clay rounded-[1px]" />
                Admin reviews and approves
              </div>
            </div>
          </figure>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-navy-600 text-white text-center">
        <div className="max-w-6xl mx-auto px-5 py-[clamp(4rem,12vh,8rem)]">
          <Image
            src="/tally-wordmark-white.png"
            alt="TallyCrew"
            width={200}
            height={69}
            className="w-[184px] h-auto mx-auto mb-6"
          />
          <h2 className="font-display font-semibold text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-white max-w-[18ch] mx-auto">
            Get your crew off paper this week.
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-[540px] mx-auto">
            <a
              href={REGISTER_URL}
              className="inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-paper bg-paper text-navy-600 px-6 py-[15px] transition-colors hover:bg-white active:translate-y-px"
            >
              Start free trial
            </a>
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
