"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Only ever redirect to a same-origin relative path — never let a query
// param send the user off-site.
function safeRedirectTarget(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const guardRes = await fetch("/api/auth/login-guard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!guardRes.ok) {
      const { error: guardError } = await guardRes.json().catch(() => ({ error: "Too many login attempts. Please try again later." }));
      setError(guardError);
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Get role to decide where to redirect
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Something went wrong."); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    const redirectTo = safeRedirectTarget(searchParams.get("redirectTo"));
    router.push(redirectTo ?? (profile?.role === "admin" ? "/admin/dashboard" : "/"));
    router.refresh();

    if (profile?.company_id) {
      const { identifyUser } = await import("@/lib/notifications");
      identifyUser(user.id, profile.company_id).catch(console.error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Branded header */}
          <div className="bg-white border-b border-gray-100 px-6 py-6 flex flex-col items-center gap-1">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={200} height={52} priority />
            <p className="text-gray-400 text-sm mt-2">Sign in to your account</p>
          </div>

          {/* Form */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <a href="/forgot-password" className="text-sm text-green-600 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 text-center text-sm text-gray-500">
              <p>
                New company?{" "}
                <a href="/register" className="text-green-600 hover:underline font-medium">
                  Create an account
                </a>
              </p>
              <p>
                Have an invite code?{" "}
                <a href="/register/join" className="text-green-600 hover:underline font-medium">
                  Join your team
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
