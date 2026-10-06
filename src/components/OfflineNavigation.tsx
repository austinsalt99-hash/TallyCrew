"use client";

import { useEffect } from "react";

// Next.js moves between pages by fetching each page's data in-app. Offline, that
// fetch fails and the tap does nothing. While offline, internal link taps do a
// full page load instead, so the service worker can serve the page from cache or
// show the offline page with the section's name.
export default function OfflineNavigation() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (navigator.onLine) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.origin !== window.location.origin || anchor.target || anchor.hasAttribute("download")) return;
      // Same page, or a #hash on this page: nothing to load.
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;

      // Capture phase, so Next's Link handler never sees the tap.
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(anchor.href);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
