"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Landing page for the "reset password" email link. The link can arrive in three shapes:
// - ?token_hash=...&type=recovery: the email template links here directly. Works in any
//   browser, including when the reset was requested in the app but opened from Mail.
// - ?code=...: Supabase's default PKCE redirect. Only works in the same browser that
//   requested the reset, because the matching verifier is stored there.
// - #access_token=...&refresh_token=...: the older implicit-flow redirect.
// Each one signs the user in, then they pick a new password.
async function startRecoverySession(): Promise<boolean> {
  const supabase = createSupabaseBrowser();
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));

  if (query.get("error") || hash.get("error")) return false;

  const tokenHash = query.get("token_hash");
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    return !error;
  }

  const code = query.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return true;
    // The client may already have exchanged the code itself while starting up.
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  }

  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return !error;
  }

  return false;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    startRecoverySession()
      .catch(() => false)
      .then((ok) => {
        if (ok) setReady(true);
        else setInvalid(true);
        // Drop the one-time token from the address bar so a refresh or shared URL can't reuse it.
        window.history.replaceState(null, "", window.location.pathname);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || "Something went wrong. Please try again.");
      return;
    }

    setDone(true);
    setTimeout(() => router.replace("/login"), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-white border-b border-gray-100 px-6 py-6 flex flex-col items-center gap-1">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={200} height={52} priority />
            <p className="text-gray-400 text-sm mt-2">Set a new password</p>
          </div>

          <div className="p-6">
            {invalid ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  This password reset link is invalid or has expired.
                </p>
                <a href="/forgot-password" className="inline-block text-green-600 hover:underline font-medium text-sm">
                  Request a new link
                </a>
              </div>
            ) : done ? (
              <p className="text-sm text-gray-600 text-center">
                Your password has been updated. Redirecting you to sign in…
              </p>
            ) : !ready ? (
              <p className="text-sm text-gray-400 text-center">Verifying link…</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
