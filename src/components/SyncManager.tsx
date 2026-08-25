"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { listQueuedSubmissions, removeQueuedSubmission, markQueuedSubmissionError } from "@/lib/offlineQueue";

async function flushQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const queued = await listQueuedSubmissions();
  for (const item of queued) {
    if (item.lastError) continue;
    try {
      const res = await fetch("/api/submit", {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        await removeQueuedSubmission(item.id);
        window.dispatchEvent(
          new CustomEvent("tallycrew:offline-sync-flushed", {
            detail: { date: item.payload.date, id: result.id },
          })
        );
      } else {
        const body = await res.json().catch(() => ({}));
        await markQueuedSubmissionError(item.id, res.status, body.error || "Submission failed");
        window.dispatchEvent(
          new CustomEvent("tallycrew:offline-sync-error", { detail: { date: item.payload.date } })
        );
      }
    } catch {
      // Still offline mid-flush — stop this pass, the next trigger will retry.
      break;
    }
  }
}

export default function SyncManager() {
  useEffect(() => {
    flushQueue();
    window.addEventListener("online", flushQueue);

    let removeResumeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("resume", flushQueue).then((handle) => {
          removeResumeListener = () => handle.remove();
        });
      });
    }

    return () => {
      window.removeEventListener("online", flushQueue);
      removeResumeListener?.();
    };
  }, []);

  return null;
}
