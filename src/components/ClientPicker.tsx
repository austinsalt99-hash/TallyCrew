"use client";

import { useEffect, useRef, useState } from "react";

export interface ClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

// One shared fetch for every picker on the page; reset after a contact is added or edited.
let clientsCache: Promise<ClientContact[]> | null = null;

export function loadClients(): Promise<ClientContact[]> {
  if (!clientsCache) {
    clientsCache = fetch("/api/clients", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);
  }
  return clientsCache;
}

export function invalidateClients() {
  clientsCache = null;
}

export interface ClientPick {
  name: string;
  clientId: string | null;
  client: ClientContact | null;
}

// A client-name field that searches the contact list. Picking a contact links
// it (clientId); typing a name that isn't saved yet offers to save it.
export default function ClientPicker({
  name, clientId, onChange, placeholder = "Search or type a client name", inputClassName,
}: {
  name: string;
  clientId: string | null;
  onChange: (pick: ClientPick) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [clients, setClients] = useState<ClientContact[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadClients().then(setClients); }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = name.trim().toLowerCase();
  const exact = term ? clients.find((c) => c.name.toLowerCase() === term) : undefined;
  const matches = (term ? clients.filter((c) => c.name.toLowerCase().includes(term)) : clients).slice(0, 6);
  const linked = clientId ? clients.find((c) => c.id === clientId) : undefined;

  function type(value: string) {
    const match = clients.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
    onChange({ name: value, clientId: match?.id ?? null, client: match ?? null });
    setOpen(true);
    setCreating(false);
  }

  function pick(c: ClientContact) {
    onChange({ name: c.name, clientId: c.id, client: c });
    setOpen(false);
    setCreating(false);
  }

  async function saveNew() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim(), email, phone, address }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Couldn't save the contact."); return; }
    invalidateClients();
    loadClients().then(setClients);
    setCreating(false);
    setEmail(""); setPhone(""); setAddress("");
    onChange({ name: data.name, clientId: data.id, client: data });
  }

  const inputCls = inputClassName ?? "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";
  const smallInput = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={name}
        onChange={(e) => type(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      {linked && !creating && (
        <p className="text-[11px] text-green-600 mt-1 truncate">
          ✓ Saved contact{linked.email ? ` · ${linked.email}` : ""}{linked.phone ? ` · ${linked.phone}` : ""}
        </p>
      )}

      {open && !creating && (matches.length > 0 || (term && !exact)) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-40 overflow-hidden max-h-64 overflow-y-auto">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${c.id === clientId ? "bg-navy-50" : ""}`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              {(c.email || c.phone) && (
                <p className="text-xs text-gray-400 truncate">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              )}
            </button>
          ))}
          {term && !exact && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setCreating(true); setOpen(false); setError(""); }}
              className="w-full text-left px-3 py-2.5 text-sm font-semibold text-navy-600 hover:bg-gray-50 border-t border-gray-100"
            >
              + Save &ldquo;{name.trim()}&rdquo; as a new contact
            </button>
          )}
        </div>
      )}

      {creating && (
        <div className="mt-2 border border-navy-100 bg-navy-50/40 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">New contact: {name.trim()}</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className={smallInput} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" type="tel" className={smallInput} />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className={smallInput} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreating(false)} className="flex-1 border border-gray-300 rounded-lg py-1.5 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={saveNew} disabled={saving}
              className="flex-1 bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white rounded-lg py-1.5 text-xs font-semibold">
              {saving ? "Saving…" : "Save contact"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
