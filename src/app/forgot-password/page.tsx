"use client";

import Image from "next/image";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);

    // Always show the same success state, whether or not the email exists,
    // so this form can't be used to enumerate registered accounts.
    if (resetError) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-white border-b border-gray-100 px-6 py-6 flex flex-col items-center gap-1">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={200} height={52} priority />
            <p className="text-gray-400 text-sm mt-2">Reset your password</p>
          </div>

          <div className="p-6">
            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  If an account exists for <span className="font-medium text-gray-900">{email}</span>,
                  we&apos;ve sent a link to reset your password.
                </p>
                <a href="/login" className="inline-block text-green-600 hover:underline font-medium text-sm">
                  Back to sign in
                </a>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Enter the email address on your account and we&apos;ll send you a link to reset your password.
                </p>
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

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
                  <a href="/login" className="text-green-600 hover:underline font-medium">
                    Back to sign in
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
