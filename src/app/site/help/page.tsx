import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help — TallyCrew",
  description: "Answers to common questions about getting set up, billing, and how TallyCrew works day to day.",
};

const SECTIONS: { num: string; title: string; faqs: { q: string; a: string }[] }[] = [
  {
    num: "01",
    title: "Getting started",
    faqs: [
      {
        q: "Do I need the app to use TallyCrew?",
        a: "No — TallyCrew works the same in a browser or the mobile app. Most crews install the app for quick access and voice logging, but nothing about your day-to-day work requires it.",
      },
      {
        q: "How do I create a company account?",
        a: "New company accounts are created on the web, at tallycrew.ca — not inside the iOS or Android app. Once your company exists, every admin and worker can install the app and sign in like normal.",
      },
      {
        q: "I have an invite code from my employer. Where do I use it?",
        a: "Also on the web. Open the invite link your admin sent you (or go to tallycrew.ca) to set up your login — that one-time step happens in a browser, then you're free to use the app from then on.",
      },
      {
        q: "Why can't I sign up from inside the app?",
        a: "App Store rules don't allow business account sign-up inside the app itself, so that one step lives on the web. It only affects creating a brand-new login — everything else works fully in the app.",
      },
    ],
  },
  {
    num: "02",
    title: "Billing & plans",
    faqs: [
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
    ],
  },
  {
    num: "03",
    title: "Day to day",
    faqs: [
      {
        q: "Does TallyCrew work without cell signal on site?",
        a: "Yes. Entries save on the phone and sync automatically once you're back in range.",
      },
      {
        q: "Can I log a job by voice?",
        a: "Yes — “Hey Siri, add to my TallyCrew calendar…” from the truck. It's parsed the same way as the Voice button on the Calendar page and lands as a draft for an admin to review.",
      },
    ],
  },
];

const h2Class =
  "font-display font-semibold text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[20ch]";

const secWrap =
  "max-w-6xl mx-auto px-5 py-[clamp(3rem,10vh,6rem)] grid grid-cols-1 md:grid-cols-[92px_1fr] gap-4 md:gap-[clamp(1rem,4vw,3.25rem)]";

const secNum = "font-label font-semibold text-[clamp(1.4rem,2.6vw,1.9rem)] text-clay";

const btnGhost =
  "inline-flex items-center justify-center font-display font-semibold text-[.95rem] rounded-[3px] border border-ink text-ink px-6 py-[15px] transition-colors hover:bg-ink hover:text-paper active:translate-y-px";

export default function HelpPage() {
  return (
    <>
      {/* Header */}
      <section className="border-b border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-[clamp(3.5rem,12vh,7rem)] text-center">
          <p className="font-label text-xs uppercase tracking-[0.22em] text-ink/50 mb-3.5">Help</p>
          <h1 className="font-display font-semibold text-[clamp(1.9rem,4vw,3rem)] leading-[1.1] tracking-[-0.02em]">
            Common questions
          </h1>
          <p className="mt-4 text-ink/60 max-w-[46ch] mx-auto text-[1.05rem] leading-relaxed">
            Answers about getting set up, billing, and how TallyCrew works day to day.
          </p>
        </div>
      </section>

      {SECTIONS.map((section, i) => (
        <section key={section.num} className={i > 0 ? "border-t border-hairline" : ""}>
          <div className={secWrap}>
            <div className={secNum}>{section.num}</div>
            <div>
              <h2 className={h2Class}>{section.title}</h2>
              <dl className="mt-8 border-t border-hairline">
                {section.faqs.map((faq) => (
                  <div key={faq.q} className="py-6 border-b border-hairline">
                    <dt className="font-display font-semibold text-[1.05rem]">{faq.q}</dt>
                    <dd className="mt-2 text-ink/60 text-[.97rem] leading-relaxed max-w-[64ch]">{faq.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      ))}

      {/* Still stuck */}
      <section className="bg-sand border-t border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-[clamp(3.5rem,12vh,6rem)] text-center">
          <h2 className={`${h2Class} mx-auto`}>Still stuck?</h2>
          <p className="mt-4 text-ink/60 max-w-[46ch] mx-auto text-[1.05rem] leading-relaxed">
            Email us and we&apos;ll get back to you personally — no ticket system, no bot.
          </p>
          <a href="mailto:austinsalt99@gmail.com" className={`${btnGhost} mt-7`}>
            austinsalt99@gmail.com
          </a>
        </div>
      </section>
    </>
  );
}
