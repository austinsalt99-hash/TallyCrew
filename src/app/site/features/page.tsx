import type { Metadata } from "next";
import Link from "next/link";
import SiriMockup from "../_components/mockups/SiriMockup";
import LogTypeBuilderMockup from "../_components/mockups/LogTypeBuilderMockup";
import CalendarMockup from "../_components/mockups/CalendarMockup";
import TimesheetMockup from "../_components/mockups/TimesheetMockup";
import InvoiceMockup from "../_components/mockups/InvoiceMockup";
import PhoneFrame from "../_components/mockups/PhoneFrame";
import { REGISTER_URL } from "../_lib/constants";

export const metadata: Metadata = {
  title: "Features — TallyCrew",
  description: "Voice logging, custom job types, scheduling, invoicing, and a native mobile app — see how TallyCrew works.",
};

function Section({
  id,
  eyebrow,
  eyebrowColor = "text-blue-600",
  title,
  body,
  visual,
  reverse = false,
}: {
  id: string;
  eyebrow: string;
  eyebrowColor?: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="py-16 md:py-20 border-b border-gray-100 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-12 items-center">
        <div className={reverse ? "md:order-2" : ""}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${eyebrowColor}`}>{eyebrow}</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-gray-500 leading-relaxed">{body}</p>
        </div>
        <div className={reverse ? "md:order-1" : ""}>{visual}</div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-navy-900 to-navy-600 py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-5 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Built for how crews actually work</h1>
          <p className="text-navy-100 max-w-xl mx-auto">
            Every feature below is exactly what runs in the app today — take it for a spin on the{" "}
            <Link href="/demo" className="text-orange-300 hover:text-orange-200 underline">live demo</Link>.
          </p>
        </div>
      </section>

      <Section
        id="siri"
        eyebrow="Siri Shortcuts"
        title="Log a job hands-free, right from the truck"
        body={
          "Say “Hey Siri, add to my TallyCrew calendar…” and describe the job the same way you would with the Voice " +
          "button on the Calendar page. It's parsed the same way and saved as an unverified draft for an admin to " +
          "review — nothing hits the schedule until someone signs off on it. No unlocking a phone, no typing with " +
          "work gloves on."
        }
        visual={<SiriMockup />}
      />

      <Section
        id="log-types"
        eyebrow="Custom Log Types"
        eyebrowColor="text-orange-500"
        title="Configure fields for exactly how your trade bills"
        body={
          "Every company's work looks different. Build named log types — Trucking, Machine Operating, General " +
          "Labor, anything — each with its own dropdown, number, and text fields. Set whether a type is timed " +
          "per-job or per-day, and price it per hour or per unit, down to individual worker rate overrides."
        }
        visual={<LogTypeBuilderMockup />}
        reverse
      />

      <Section
        id="calendar"
        eyebrow="Scheduling"
        title="One shared calendar for the whole crew"
        body={
          "Drag and drop jobs onto a company-wide calendar. Link an employee's logged hours straight to the job " +
          "they belong to, and keep unverified drafts (like ones added by Siri) visually distinct until an admin " +
          "confirms them. Everyone always knows where they're supposed to be."
        }
        visual={<CalendarMockup />}
      />

      <Section
        id="timesheets"
        eyebrow="Timesheets"
        eyebrowColor="text-orange-500"
        title="Billable and non-billable hours, logged in seconds"
        body={
          "Crew members fill in their day from a phone — billable entries by client and job type, non-billable " +
          "entries for shop time or maintenance. Each entry adapts to whatever custom fields the admin configured, " +
          "so the form only ever asks for what actually matters for that job."
        }
        visual={
          <div className="flex justify-center">
            <PhoneFrame>
              <TimesheetMockup />
            </PhoneFrame>
          </div>
        }
        reverse
      />

      <Section
        id="invoicing"
        eyebrow="Invoicing"
        title="Logged hours become an invoice automatically"
        body={
          "Once hours are submitted and verified, generate a client invoice straight from what was actually " +
          "logged — labor, trucking, equipment, whatever line items apply — instead of re-keying numbers from a " +
          "paper timesheet into a separate invoicing tool."
        }
        visual={<InvoiceMockup />}
      />

      <section className="bg-navy-900 py-16 md:py-20 text-center">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">See it running for yourself</h2>
          <p className="text-navy-200 mb-8">No account needed — the live demo uses sample data so you can click around freely.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/demo" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors">
              Try the Live Demo
            </Link>
            <a href={REGISTER_URL} className="bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl px-6 py-3.5 border border-white/20 transition-colors">
              Start Free Trial
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
