import Link from "next/link";
import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer className="bg-navy-900 text-navy-100">
      <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <Image src="/tally-wordmark-white.png" alt="TallyCrew" width={140} height={33} />
          <p className="text-sm text-navy-300 mt-4 max-w-xs">
            Timesheets, scheduling, and crew management built for trades and field service teams.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">Product</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
            <li><Link href="/demo" className="hover:text-white transition-colors">Live Demo</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">Company</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">Get Started</p>
          <ul className="space-y-2 text-sm">
            <li><a href="https://app.tallycrew.ca/register" className="hover:text-white transition-colors">Start Free Trial</a></li>
            <li><a href="https://app.tallycrew.ca/login" className="hover:text-white transition-colors">Log In</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="max-w-6xl mx-auto px-5 py-5 text-xs text-navy-400">
          &copy; {new Date().getFullYear()} TallyCrew. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
