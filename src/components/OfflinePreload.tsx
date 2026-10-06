"use client";

import { useEffect } from "react";
import { preloadOfflineData } from "@/lib/offlinePreload";

// Runs the offline preload a few seconds after the app loads, so it doesn't compete
// with the first screen, and again whenever the connection comes back.
export default function OfflinePreload() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      preloadOfflineData().catch(console.error);
    }, 5000);
    const onOnline = () => {
      preloadOfflineData().catch(console.error);
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
