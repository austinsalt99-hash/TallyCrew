"use client";

import { useEffect } from "react";
import { preloadOfflineData } from "@/lib/offlinePreload";
import { warmCache, watchForDataChanges } from "@/lib/pageCache";
import { mainTabUrls } from "@/lib/mainTabUrls";

// Loads the bottom-nav tabs' data into the page cache shortly after the app opens, so
// switching to a tab shows its data at once. Skipped on pages outside the signed-in app.
async function warmMainTabs() {
  if (!/^\/(admin|dashboard|schedule|profile|settings|time-off)?(\/|$)/.test(window.location.pathname)) return;
  const me = await fetch("/api/me", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!me?.role) return;
  await warmCache(mainTabUrls(me.role === "admin" ? "admin" : "worker"));
}

// Runs the offline preload a few seconds after the app loads, so it doesn't compete
// with the first screen, and again whenever the connection comes back.
export default function OfflinePreload() {
  useEffect(() => {
    watchForDataChanges();
    const warmTimer = window.setTimeout(() => {
      warmMainTabs().catch(console.error);
    }, 2000);
    const timer = window.setTimeout(() => {
      preloadOfflineData().catch(console.error);
    }, 5000);
    const onOnline = () => {
      preloadOfflineData().catch(console.error);
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(warmTimer);
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
