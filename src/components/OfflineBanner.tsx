"use client";

import { useOnlineStatus } from "@/lib/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      className="print:hidden fixed left-0 right-0 z-30 bg-amber-500 text-white text-xs font-semibold text-center py-1 top-[calc(env(safe-area-inset-top)+2.75rem)] md:top-0"
    >
      You&rsquo;re offline — showing saved data
    </div>
  );
}
