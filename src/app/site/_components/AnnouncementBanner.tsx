"use client";

import { useState, useSyncExternalStore } from "react";
import { REGISTER_URL } from "../_lib/constants";

const DISMISS_KEY = "tc-site-banner-dismissed";

// Dismissal never changes on its own (no event fires sessionStorage updates), so
// there's nothing to subscribe to — this only exists so the initial read can be
// deferred to after hydration (see getServerSnapshot below) without a mismatch.
function subscribeNever() {
  return () => {};
}

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AnnouncementBanner() {
  // The server always renders the banner (it has no sessionStorage to check), so
  // getServerSnapshot matches that until hydration completes, then picks up a
  // dismissal from earlier this browsing session without a hydration mismatch.
  const dismissedEarlier = useSyncExternalStore(subscribeNever, readDismissed, () => false);
  const [justDismissed, setJustDismissed] = useState(false);

  if (dismissedEarlier || justDismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private browsing / storage disabled — it just won't stay dismissed across pages.
    }
    setJustDismissed(true);
  }

  return (
    <div className="relative bg-red-600 text-white">
      <div className="max-w-6xl mx-auto px-10 py-2.5 text-center text-sm font-semibold">
        <a href={REGISTER_URL} className="hover:underline underline-offset-2">
          New company accounts can only be created on the web — not in the iOS or Android app.
        </a>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/80 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
