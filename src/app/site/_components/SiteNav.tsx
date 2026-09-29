"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { REGISTER_URL, LOGIN_URL } from "../_lib/constants";
import StoreButton from "./StoreButton";

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  // "/" only serves the marketing home page when the Host is exactly
  // tallycrew.ca — src/proxy.ts rewrites it there, but leaves every other
  // host (localhost, preview deployments, www.tallycrew.ca) serving the
  // product at "/" instead, so the logo link needs to know which one it's on.
  // Default to "/" since that's correct on production (the common case, and
  // zero-flash there); only override post-mount when it isn't.
  const [homeHref, setHomeHref] = useState("/");
  useEffect(() => {
    if (window.location.hostname !== "tallycrew.ca") setHomeHref("/site");
  }, []);

  // Features now lives on the homepage itself (below "Why choose TallyCrew?")
  // rather than its own /features page, so this link needs the same
  // host-aware home path as the logo, not a hardcoded "/#features".
  const LINKS = [
    { href: `${homeHref}#features`, label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/demo", label: "Live Demo" },
    { href: "/help", label: "Help" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/85 backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href={homeHref} className="flex items-center" onClick={() => setOpen(false)}>
          <Image
            src="/tally-wordmark-transparent.png"
            alt="TallyCrew"
            width={132}
            height={31}
            priority
            className="h-[22px] w-auto"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-display text-sm font-semibold text-ink/55 hover:text-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-5">
          <StoreButton
            className="font-display text-sm font-semibold text-ink/55 hover:text-ink transition-colors"
            iosLabel="Get the App"
            androidLabel="Get the App"
          />
          <a
            href={LOGIN_URL}
            className="font-display text-sm font-semibold text-ink/55 hover:text-ink transition-colors"
          >
            Log in
          </a>
          <a
            href={REGISTER_URL}
            className="font-display text-sm font-semibold text-ink border border-ink rounded-[3px] px-4 py-2 hover:bg-ink hover:text-paper transition-colors"
          >
            Start Free Trial
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-ink"
        >
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-hairline bg-paper px-5 py-4 space-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block font-display text-sm font-semibold text-ink py-1.5"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <a href={LOGIN_URL} className="font-display text-sm font-semibold text-ink/60 py-1.5">
              Log in
            </a>
            <StoreButton
              className="font-display text-sm font-semibold text-ink/60 py-1.5"
              iosLabel="Get the App"
              androidLabel="Get the App"
            />
            <a
              href={REGISTER_URL}
              className="font-display text-sm font-semibold text-ink border border-ink rounded-[3px] px-4 py-3 text-center hover:bg-ink hover:text-paper transition-colors"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
