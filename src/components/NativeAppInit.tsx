"use client";

import { useEffect } from "react";
import { initNativeApp } from "@/lib/capacitor";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function NativeAppInit() {
  useEffect(() => {
    async function init() {
      await initNativeApp();

      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      if (!profile?.company_id) return;
      const { identifyUser } = await import("@/lib/notifications");
      await identifyUser(user.id, profile.company_id);
    }
    init().catch(console.error);
  }, []);

  return null;
}
