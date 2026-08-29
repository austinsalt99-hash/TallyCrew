import Link from "next/link";
import Image from "next/image";
import { REGISTER_URL, LOGIN_URL } from "../_lib/constants";

export default function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-paper">
      <div className="max-w-6xl mx-auto px-5 pt-14 pb-6 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <Image
            src="/tally-wordmark-transparent.png"
            alt="TallyCrew"
            width={120}
            height={28}
            className="h-5 w-auto"
          />
          <p className="text-sm text-ink/55 mt-4 max-w-xs leading-relaxed">
            Timesheets, scheduling, and invoicing for trades and field service crews.
          </p>
        </div>

        <div>
          <p className="font-display text-sm font-semibold text-ink mb-3">Product</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/features" className="text-ink/55 hover:text-ink transition-colors">Features</Link></li>
            <li><Link href="/pricing" className="text-ink/55 hover:text-ink transition-colors">Pricing</Link></li>
            <li><Link href="/demo" className="text-ink/55 hover:text-ink transition-colors">Live Demo</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-display text-sm font-semibold text-ink mb-3">Company</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacy" className="text-ink/55 hover:text-ink transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="text-ink/55 hover:text-ink transition-colors">Terms of Service</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-display text-sm font-semibold text-ink mb-3">Get started</p>
          <ul className="space-y-2 text-sm">
            <li><a href={REGISTER_URL} className="text-ink/55 hover:text-ink transition-colors">Start Free Trial</a></li>
            <li><a href={LOGIN_URL} className="text-ink/55 hover:text-ink transition-colors">Log In</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-5 text-xs text-ink/45">
          &copy; {new Date().getFullYear()} TallyCrew. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
