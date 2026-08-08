"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { REGISTER_URL, LOGIN_URL } from "../_lib/constants";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Live Demo" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" onClick={() => setOpen(false)}>
          <Image src="/tally-wordmark.png" alt="TallyCrew" width={140} height={33} priority />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-gray-600 hover:text-navy-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a href={LOGIN_URL} className="text-sm font-semibold text-gray-600 hover:text-navy-600 transition-colors">
            Log in
          </a>
          <a
            href={REGISTER_URL}
            className="bg-navy-600 hover:bg-navy-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
          >
            Start Free Trial
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-gray-700"
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
        <div className="md:hidden border-t border-gray-200 bg-white px-5 py-4 space-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block text-sm font-semibold text-gray-700 py-1.5"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <a href={LOGIN_URL} className="text-sm font-semibold text-gray-600 py-1.5">
              Log in
            </a>
            <a
              href={REGISTER_URL}
              className="bg-navy-600 hover:bg-navy-700 text-white text-sm font-semibold rounded-xl px-4 py-3 text-center transition-colors"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
