"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientContact } from "@/components/ClientPicker";
import { invalidateClients } from "@/components/ClientPicker";
import type { QuoteStatus } from "@/types/quote";
import { QUOTE_STATUS_BADGE, quoteDisplayStatus } from "@/types/quote";
import { formatInvoiceDate, formatMoney } from "../invoices/_components/invoiceFormat";
import PaidProgress from "@/components/PaidProgress";

interface ClientDetail {
  client: ClientContact;
  quotes: { id: string; quote_number: string | null; title: string; status: QuoteStatus; valid_until: string | null; total: number; amount_paid: number }[];
  invoices: { id: string; invoice_number: string; invoice_date: string; status: string; total: number; amount_paid: number }[];
  jobs: { id: string; title: string; date: string; status: string | null }[];
}

const EMPTY = { name: "", email: "", phone: "", address: "", notes: "" };
const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";
const INVOICE_LABEL: Record<string, string> = { draft: "Draft", sent: "Sent", partial: "Partly paid", paid: "Paid" };

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null); // "new" for a new contact
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function loadList() {
    return fetch("/api/clients", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setClients(Array.isArray(data) ? data : []); setLoading(false); });
  }

  useEffect(() => { loadList(); }, []);

  async function open(id: string) {
    setOpenId(id);
    setError("");
    setConfirmDelete(false);
    if (id === "new") { setDetail(null); setForm(EMPTY); return; }
    setDetail(null);
    const res = await fetch(`/api/clients/${id}`, { credentials: "include" });
    if (!res.ok) return;
    const data: ClientDetail = await res.json();
    setDetail(data);
    const c = data.client;
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    const isNew = openId === "new";
    const res = await fetch(isNew ? "/api/clients" : `/api/clients/${openId}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Couldn't save."); return; }
    invalidateClients();
    await loadList();
    if (isNew) await open(data.id);
    else setOpenId(null);
  }

  async function remove() {
    if (!openId || openId === "new") return;
    await fetch(`/api/clients/${openId}`, { method: "DELETE", credentials: "include" });
    invalidateClients();
    setOpenId(null);
    await loadList();
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? clients.filter((c) => [c.name, c.email, c.phone, c.address].some((v) => v?.toLowerCase().includes(term)))
    : clients;

  if (loading) return <p className="text-gray-500">Loading clients...</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button onClick={() => open("new")} className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-4 py-2 text-sm">
          + New Client
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone or address"
        className={`${inputCls} mb-4 bg-white`} />

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          {clients.length === 0
            ? <>No clients yet. They&apos;re added when you save a new client on a job, quote or invoice — or <button onClick={() => open("new")} className="text-navy-600 underline">add one now</button>.</>
            : "No clients match that search."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visible.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
              <p className="text-sm font-semibold text-gray-900">{c.name}</p>
              {(c.email || c.phone || c.address) && (
                <p className="text-xs text-gray-400 truncate">{[c.email, c.phone, c.address].filter(Boolean).join(" · ")}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setOpenId(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">{openId === "new" ? "New Client" : form.name || "Client"}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 [&>*]:min-w-0">
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputCls} resize-none`} />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setOpenId(null)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Close
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-bold">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>

            {detail && (
              <>
                <div className="flex gap-2 flex-wrap">
                  <Link href="/admin/quotes/new" className="text-xs font-semibold text-navy-600 border border-navy-200 rounded-lg px-2.5 py-1.5 hover:bg-navy-50">
                    + New quote
                  </Link>
                  <Link href="/admin/invoices/new" className="text-xs font-semibold text-navy-600 border border-navy-200 rounded-lg px-2.5 py-1.5 hover:bg-navy-50">
                    + New invoice
                  </Link>
                </div>

                <section>
                  <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2">Quotes ({detail.quotes.length})</h3>
                  {detail.quotes.length === 0 ? <p className="text-sm text-gray-400">None yet.</p> : (
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                      {detail.quotes.map((q) => {
                        const shown = quoteDisplayStatus(q);
                        return (
                          <Link key={q.id} href={`/admin/quotes/${q.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50">
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900 truncate">{q.title}</p>
                              <p className="text-xs text-gray-400">{q.quote_number} · {formatMoney(Number(q.total) || 0)}</p>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${QUOTE_STATUS_BADGE[shown]}`}>{shown}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2">Invoices ({detail.invoices.length})</h3>
                  {detail.invoices.length === 0 ? <p className="text-sm text-gray-400">None yet.</p> : (
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                      {detail.invoices.map((inv) => (
                        <Link key={inv.id} href={`/admin/invoices/${inv.id}`} className="block px-3 py-2.5 hover:bg-gray-50">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900">{inv.invoice_number}</p>
                              <p className="text-xs text-gray-400">{formatInvoiceDate(inv.invoice_date)} · {formatMoney(Number(inv.total) || 0)}</p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-gray-500">{INVOICE_LABEL[inv.status] ?? inv.status}</span>
                          </div>
                          {Number(inv.total) > 0 && inv.status !== "draft" && (
                            <div className="mt-1.5"><PaidProgress paid={inv.amount_paid} total={Number(inv.total)} compact /></div>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2">Jobs ({detail.jobs.length})</h3>
                  {detail.jobs.length === 0 ? <p className="text-sm text-gray-400">None yet.</p> : (
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                      {detail.jobs.map((j) => (
                        <div key={j.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <p className="text-sm text-gray-900 truncate">{j.title}</p>
                          <span className="shrink-0 text-xs text-gray-400">{formatInvoiceDate(j.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="pt-1">
                  {confirmDelete ? (
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-gray-600">Delete this contact? Jobs, quotes and invoices keep the client name.</span>
                      <button onClick={remove} className="text-red-600 font-semibold">Yes, delete</button>
                      <button onClick={() => setConfirmDelete(false)} className="text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 hover:text-red-700">Delete contact</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
