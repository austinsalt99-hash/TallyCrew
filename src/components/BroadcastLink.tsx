"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function BroadcastLink() {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("is_dev")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_dev) setIsDev(true);
        });
    });
  }, []);

  if (!isDev) return null;

  return (
    <a
      href="/internal/broadcast"
      className="flex items-center gap-1.5 text-xs border border-dashed border-purple-400 text-purple-500 rounded-lg px-2.5 py-1 hover:bg-purple-50 transition-colors"
    >
      <span className="font-semibold">DEV</span>
      <span className="text-gray-500">Broadcast</span>
    </a>
  );
}
