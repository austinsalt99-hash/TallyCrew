"use client";

import { useEffect, useMemo, useState } from "react";

interface Recipient {
  id: string;
  full_name: string;
  role: "admin" | "worker";
  company_name: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BroadcastComposer() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [extraEmailInput, setExtraEmailInput] = useState("");

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/internal/broadcast")
      .then((res) => res.json())
      .then((data) => setRecipients(data.recipients ?? []))
      .catch(() => {});
  }, []);

  const adminCount = useMemo(() => recipients.filter((r) => r.role === "admin").length, [recipients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) => r.full_name.toLowerCase().includes(q) || r.company_name.toLowerCase().includes(q)
    );
  }, [recipients, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Recipient[]>();
    for (const r of filtered) {
      const list = map.get(r.company_name) ?? [];
      list.push(r);
      map.set(r.company_name, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(recipients.map((r) => r.id)));
  const selectAdmins = () => setSelectedIds(new Set(recipients.filter((r) => r.role === "admin").map((r) => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const addExtraEmail = () => {
    const email = extraEmailInput.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError(`"${email}" doesn't look like a valid email address`);
      return;
    }
    if (!extraEmails.includes(email)) setExtraEmails((prev) => [...prev, email]);
    setExtraEmailInput("");
    setError(null);
  };

  const removeExtraEmail = (email: string) => {
    setExtraEmails((prev) => prev.filter((e) => e !== email));
  };

  const totalCount = selectedIds.size + extraEmails.length;

  const handleSendTest = async () => {
    if (!subject.trim() || !body.trim()) return;
    setTestSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/internal/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, test: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test send failed");
      setResult(`Test sent to ${data.sentTo} — check your inbox.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setTestSending(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    if (totalCount === 0) {
      setError("Select at least one recipient");
      return;
    }
    const confirmed = window.confirm(
      `Send this email to ${totalCount} recipient${totalCount === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!confirmed) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/internal/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          recipientIds: Array.from(selectedIds),
          extraEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setResult(
        `Sent to ${data.sent} of ${data.totalRecipients} recipients.` +
          (data.failedBatches ? ` ${data.failedBatches} batch(es) failed — check logs.` : "")
      );
      setSubject("");
      setBody("");
      clearSelection();
      setExtraEmails([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Recipients</label>
          <span className="text-xs text-gray-500">{totalCount} selected</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          >
            Everyone ({recipients.length})
          </button>
          <button
            type="button"
            onClick={selectAdmins}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          >
            Admins only ({adminCount})
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-1 text-sm text-blue-600 font-medium"
        >
          <span className={`transition-transform ${showPicker ? "rotate-90" : ""}`}>›</span>
          Choose individually
        </button>

        {showPicker && (
          <>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or company…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {grouped.length === 0 && (
                <p className="text-sm text-gray-400 px-3 py-4 text-center">No matches.</p>
              )}
              {grouped.map(([companyName, people]) => (
                <div key={companyName} className="px-3 py-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{companyName}</p>
                  {people.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 py-1 text-sm text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="rounded border-gray-300"
                      />
                      <span>{r.full_name}</span>
                      <span className="text-xs text-gray-400">({r.role})</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Also send to (not a TallyCrew account)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={extraEmailInput}
              onChange={(e) => setExtraEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExtraEmail();
                }
              }}
              placeholder="someone@example.com"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addExtraEmail}
              className="px-3 py-2 rounded-xl text-sm font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              Add
            </button>
          </div>
          {extraEmails.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {extraEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-full px-3 py-1"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeExtraEmail(email)}
                    className="text-blue-500 hover:text-blue-800"
                    aria-label={`Remove ${email}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <div>
          <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder="e.g. Updates to our Terms of Service"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder="Write the email as plain text — blank lines become paragraph breaks."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && <p className="text-sm text-green-600">{result}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testSending || sending || !subject.trim() || !body.trim()}
            className="bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold rounded-xl px-4 py-2 text-sm border border-gray-200"
          >
            {testSending ? "Sending test…" : "Send test to yourself"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || testSending || !subject.trim() || !body.trim() || totalCount === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2 text-sm"
          >
            {sending ? "Sending…" : `Send${totalCount ? ` (${totalCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
