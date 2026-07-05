"use client";

import { useEffect, useState } from "react";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  used_at: string | null;
  is_active: boolean;
}

function formatDate(iso: string): string {
  const [y, mo, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/workers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setWorkers(data); })
      .finally(() => setLoadingWorkers(false));

    loadCodes();
  }, []);

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
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (data.code) {
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

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeCodes = codes.filter((c) => c.is_active && !c.used_at);
  const usedCodes = codes.filter((c) => !!c.used_at);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Workers</h1>

      {/* Team members */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Team members</h2>
        </div>
        {loadingWorkers ? (
          <p className="px-5 py-4 text-sm text-gray-400">Loading…</p>
        ) : workers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No workers yet. Generate an invite code below.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {workers.map((w) => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{w.full_name}</p>
                  <p className="text-xs text-gray-400">Joined {formatDate(w.created_at)}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  w.role === "admin"
                    ? "bg-navy-100 text-navy-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {w.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite codes */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Invite codes</h2>
          <button
            onClick={generateCode}
            disabled={generatingCode}
            className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            {generatingCode ? "Generating…" : "Generate code"}
          </button>
        </div>

        {/* Newly generated code */}
        {newCode && (
          <div className="mx-5 mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-0.5">New invite code</p>
              <p className="font-mono text-xl font-bold text-green-800 tracking-widest">{newCode}</p>
              <p className="text-xs text-green-600 mt-1">Share this with your worker. It can only be used once.</p>
            </div>
            <button
              onClick={() => copyCode(newCode)}
              className="shrink-0 text-sm font-semibold text-green-700 border border-green-300 hover:bg-green-100 rounded-lg px-3 py-2 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        <div className="px-5 py-4">
          {loadingCodes ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : activeCodes.length === 0 && usedCodes.length === 0 ? (
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
                          <button
                            onClick={() => copyCode(c.code)}
                            className="text-xs text-navy-600 hover:underline"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => revokeCode(c.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Revoke
                          </button>
                        </div>
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

      <div className="bg-navy-50 border border-navy-200 rounded-xl px-5 py-4">
        <p className="text-sm text-navy-800 font-semibold mb-1">How invite codes work</p>
        <p className="text-sm text-navy-700">
          Generate a code and share it with your worker. They go to{" "}
          <span className="font-mono bg-navy-100 px-1 rounded">/register/join</span>, enter the code,
          and create their account. Each code can only be used once.
        </p>
      </div>
    </div>
  );
}
