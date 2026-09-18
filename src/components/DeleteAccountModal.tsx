"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Shared by both the employee (/settings) and admin (/admin/settings) account
// screens — Apple Guideline 5.1.1(v) requires self-service account deletion
// for any app that supports account creation, for every account type, not
// just one. The actual delete (DELETE /api/account) removes the auth.users
// row itself; it does not just flip a "deactivated" flag. Business records
// the user created (timesheets, invoices, invite codes, etc.) are kept for
// the company's books — see supabase-schema.sql section 21 — with the
// personal link nulled out (ON DELETE SET NULL) rather than the row being
// cascade-deleted.
export default function DeleteAccountModal({
  isSoleAdmin,
  checkingSoleAdmin,
  onClose,
}: {
  isSoleAdmin: boolean;
  checkingSoleAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE" && !checkingSoleAdmin;

  async function handleDelete() {
    setDeleting(true);
    setError("");

    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setDeleting(false);
      return;
    }

    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Delete your account</h2>

        <p className="text-sm text-gray-600">
          This permanently deletes your login — you won&apos;t be able to sign back in. Timesheets and
          other records you created stay with your company for its books, just no longer linked to you
          personally.
        </p>

        {checkingSoleAdmin ? (
          <p className="text-sm text-gray-400">Checking your company&apos;s admins…</p>
        ) : isSoleAdmin ? (
          <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
            You&apos;re the only admin at your company. Once you delete your account, no one will be able
            to manage the dashboard, calendar, or billing — including canceling the subscription.
          </p>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold rounded-xl py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm || deleting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
