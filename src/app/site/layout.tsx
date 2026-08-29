import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import SiteNav from "./_components/SiteNav";
import SiteFooter from "./_components/SiteFooter";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-site",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-label",
});

export const metadata: Metadata = {
  title: "TallyCrew - Timesheets & Scheduling Built for Crews",
  description:
    "Voice-powered timesheets, custom job types, visual scheduling, and instant invoicing - built for trades and field service crews.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`site-shell ${display.variable} ${sans.variable} ${mono.variable} bg-paper text-ink antialiased`}
    >
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}
