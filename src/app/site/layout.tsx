import type { Metadata } from "next";
import { Sora } from "next/font/google";
import SiteNav from "./_components/SiteNav";
import SiteFooter from "./_components/SiteFooter";

const sora = Sora({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "TallyCrew — Timesheets & Scheduling Built for Crews",
  description:
    "Voice-powered timesheets, custom job types, visual scheduling, and instant invoicing — built for trades and field service crews.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`site-shell ${sora.variable} font-sans bg-white text-gray-900`}>
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}
