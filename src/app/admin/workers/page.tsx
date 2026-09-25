"use client";

import { useEffect, useState } from "react";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
  is_removed: boolean;
  removed_at: string | null;
}

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  used_at: string | null;
  is_active: boolean;
}

interface Company {
  plan_tier: string | null;
  worker_limit: number | null;
}

function formatDate(iso: string): string {
  const [y, mo, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/company", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCompany({ plan_tier: data.plan_tier ?? null, worker_limit: data.worker_limit ?? null }));

    loadWorkers();
    loadCodes();
  }, []);

  async function loadWorkers() {
    setLoadingWorkers(true);
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setWorkers(data); })
      .finally(() => setLoadingWorkers(false));
  }

  async function loadCodes() {
    setLoadingCodes(true);
    fetch("/api/admin/invite", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCodes(data); })
      .finally(() => setLoadingCodes(false));
  }

  async function generateCode() {
    setGeneratingCode(true);
    setNewCode(null);
    setError("");
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to generate invite code.");
    } else if (data.code) {
      setNewCode(data.code);
      await loadCodes();
    }
    setGeneratingCode(false);
  }

  async function revokeCode(id: string) {
    await fetch("/api/admin/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    await loadCodes();
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    setError("");
    const res = await fetch(`/api/admin/workers/${removeTarget.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not remove worker.");
      setRemoving(false);
      return;
    }
    setRemoving(false);
    setRemoveTarget(null);
    await loadWorkers();
  }

  function inviteLink(code: string): string {
    return `${window.location.origin}/register/join?code=${code}`;
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(inviteLink(code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeWorkers = workers.filter((w) => w.role === "worker" && !w.is_removed);
  const admins = workers.filter((w) => w.role === "admin");
  const removedWorkers = workers.filter((w) => w.is_removed);
  const activeCodes = codes.filter((c) => c.is_active && !c.used_at);
  const usedCodes = codes.filter((c) => !!c.used_at);

  const workerLimit = company?.worker_limit ?? null;
  const occupied = activeWorkers.length + activeCodes.length;
  const emptySeats = workerLimit != null ? Math.max(0, workerLimit - occupied) : 0;
  const atLimit = workerLimit != null && occupied >= workerLimit;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
        {workerLimit != null && (
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-3 py-1">
            {occupied} of {workerLimit} seats used
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {/* Team members */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Team members</h2>
        </div>
        {loadingWorkers ? (
          <p className="px-5 py-4 text-sm text-gray-400">Loading…</p>
        ) : admins.length === 0 && activeWorkers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No workers yet. Generate an invite code below.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {[...admins, ...activeWorkers].map((w) => (
              <div key={w.id} className="px-4 md:px-5 py-3.5 md:py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{w.full_name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      w.role === "admin" ? "bg-navy-100 text-navy-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {w.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Joined {formatDate(w.created_at)}</p>
                </div>
                {w.role === "worker" && (
                  <button
                    onClick={() => setRemoveTarget(w)}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite codes / seats */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Invite codes</h2>
          <button
            onClick={generateCode}
            disabled={generatingCode || atLimit}
            title={atLimit ? "You've reached your plan's worker limit." : undefined}
            className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            {generatingCode ? "Generating…" : "Generate code"}
          </button>
        </div>

        {atLimit && (
          <div className="mx-5 mt-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <p className="text-sm text-orange-800">
              You&apos;ve used all {workerLimit} seats on your plan. Remove a worker or revoke a pending invite to
              free up a seat, or upgrade your plan for more.
            </p>
          </div>
        )}

        {newCode && (
          <div className="mx-5 mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-0.5">New invite code</p>
              <p className="font-mono text-xl font-bold text-green-800 tracking-widest">{newCode}</p>
              <p className="text-xs text-green-600 mt-1">
                Send your worker the link below — it can only be used once.
              </p>
            </div>
            <button
              onClick={() => copyCode(newCode)}
              className="shrink-0 text-sm font-semibold text-green-700 border border-green-300 hover:bg-green-100 rounded-lg px-3 py-2 transition-colors"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        )}

        <div className="px-5 py-4">
          {loadingCodes ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : activeCodes.length === 0 && usedCodes.length === 0 && emptySeats === 0 ? (
            <p className="text-sm text-gray-400">No codes yet. Click &ldquo;Generate code&rdquo; to create one.</p>
          ) : (
            <div className="space-y-4">
              {activeCodes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Available</p>
                  <div className="space-y-2">
                    {activeCodes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-mono font-bold text-gray-800 tracking-widest">{c.code}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => copyCode(c.code)} className="text-xs text-navy-600 hover:underline">Copy link</button>
                          <button onClick={() => revokeCode(c.id)} className="text-xs text-red-500 hover:underline">Revoke</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {workerLimit != null && emptySeats > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Empty seats</p>
                  <div className="space-y-2">
                    {Array.from({ length: emptySeats }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between border border-dashed border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-400">Unused seat</span>
                        <button
                          onClick={generateCode}
                          disabled={generatingCode}
                          className="text-xs font-semibold text-navy-600 hover:underline disabled:opacity-50"
                        >
                          Generate code
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {usedCodes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Used</p>
                  <div className="space-y-2">
                    {usedCodes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 opacity-50">
                        <span className="font-mono text-gray-500 tracking-widest line-through">{c.code}</span>
                        <span className="text-xs text-gray-400">{c.used_at ? formatDate(c.used_at) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Removed workers */}
      {removedWorkers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Removed</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {removedWorkers.map((w) => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between opacity-50">
                <p className="font-medium text-gray-700">{w.full_name}</p>
                <p className="text-xs text-gray-400">
                  Removed {w.removed_at ? formatDate(w.removed_at) : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-navy-50 border border-navy-200 rounded-xl px-5 py-4">
        <p className="text-sm text-navy-800 font-semibold mb-1">How invite codes work</p>
        <p className="text-sm text-navy-700">
          Generate a code and text or email your worker the invite link. They tap it, it opens in
          their phone&apos;s browser with the code already filled in, and they create their account
          from there. Each code can only be used once.
        </p>
      </div>

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Remove {removeTarget.full_name}?</h2>
            <p className="text-sm text-gray-600">
              They&apos;ll immediately lose access to their account and won&apos;t be able to sign in. Their past
              timesheets and other records stay in your dashboard. This frees up their seat so you can invite
              someone new.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold rounded-xl py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={removing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove worker"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
