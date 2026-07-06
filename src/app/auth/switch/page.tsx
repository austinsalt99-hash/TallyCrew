"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Landing page for the dev account-switcher magic link.
// Supabase redirects here with #access_token=...&refresh_token=... in the hash.
// We extract the tokens, set the session, then navigate home.
export default function AuthSwitchPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const supabase = createSupabaseBrowser();
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        router.replace(error ? "/login" : "/");
      });
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">Switching account…</p>
    </div>
  );
}
