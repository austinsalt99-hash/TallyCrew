"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { Quote, QuoteStatus } from "@/types/quote";
import { QUOTE_STATUS_BADGE, quoteDisplayStatus } from "@/types/quote";
import { computeTotals, formatInvoiceDate } from "../../invoices/_components/invoiceFormat";
import { quoteToDocument } from "../../invoices/_components/documentModel";
import DocumentSheet from "../../invoices/_components/DocumentSheet";
import PdfButtons, { MarkSentPrompt } from "../../invoices/_components/PdfButtons";
import PaymentsCard from "@/components/PaymentsCard";
import ExpensesCard from "@/components/ExpensesCard";

const STATUS_LABEL = { draft: "Draft", sent: "Sent", approved: "Approved", declined: "Declined", expired: "Expired" };

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [askMarkSent, setAskMarkSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [job, setJob] = useState<{ title: string; date: string } | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);

  function reload() {
    return fetch(`/api/quotes/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setQuote(data); setLoading(false); });
  }

  useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/company", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data.invoice_logo_url ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!quote?.converted_job_id) return;
    createSupabaseBrowser().from("job_events").select("title, date").eq("id", quote.converted_job_id).maybeSingle()
      .then(({ data }) => setJob(data ?? null));
  }, [quote?.converted_job_id]);

  useEffect(() => {
    if (!quote?.converted_invoice_id) return;
    fetch(`/api/invoices/${quote.converted_invoice_id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => setInvoiceNumber(inv?.invoice_number ?? null));
  }, [quote?.converted_invoice_id]);

  async function setStatus(status: QuoteStatus) {
    await fetch(`/api/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    setAskMarkSent(false);
    await reload();
  }

  async function deleteQuote() {
    await fetch(`/api/quotes/${id}`, { method: "DELETE", credentials: "include" });
    router.push("/admin/quotes");
  }

  if (loading) return <p className="text-gray-500">Loading quote...</p>;
  if (!quote) return <p className="text-red-500">Quote not found.</p>;

  const doc = quoteToDocument(quote);
  const total = computeTotals(quote.line_items ?? [], quote.tax_rate).total;
  const shown = quoteDisplayStatus(quote);
  const btn = "text-sm rounded-lg px-3 py-1.5 font-medium border";

  return (
    <div className="max-w-4xl">
      {/* Admin controls — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/admin/quotes" className="text-gray-400 hover:text-gray-600 text-sm">← Quotes</Link>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${QUOTE_STATUS_BADGE[shown]}`}>{STATUS_LABEL[shown]}</span>
        <div className="flex-1" />
        <Link
          href={`/admin/quotes/${id}/edit`}
          className="text-sm border border-navy-400 text-navy-600 hover:bg-navy-50 rounded-lg px-3 py-1.5 font-semibold"
        >
          ✏ Edit Quote
        </Link>
        {quote.status === "draft" && (
          <button onClick={() => setStatus("sent")} className={`${btn} border-navy-300 text-navy-600 hover:bg-navy-50`}>Mark as Sent</button>
        )}
        {(quote.status === "draft" || quote.status === "sent") && (
          <>
            <button onClick={() => setStatus("approved")} className={`${btn} border-green-300 text-green-600 hover:bg-green-50`}>Client approved</button>
            <button onClick={() => setStatus("declined")} className={`${btn} border-red-200 text-red-500 hover:bg-red-50`}>Declined</button>
          </>
        )}
        {(quote.status === "approved" || quote.status === "declined") && (
          <button onClick={() => setStatus("sent")} className={`${btn} border-gray-300 text-gray-500 hover:bg-gray-50`}>
            {quote.status === "approved" ? "Undo approval" : "Reopen"}
          </button>
        )}
        <PdfButtons doc={doc} logoUrl={logoUrl} onExported={() => { if (quote.status === "draft") setAskMarkSent(true); }} />
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">
              Delete this quote?{(quote.amount_paid ?? 0) > 0 && !quote.converted_invoice_id ? " Its recorded deposits are removed too." : ""}
            </span>
            <button onClick={deleteQuote} className="text-red-600 font-semibold hover:text-red-700">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-gray-400">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
        )}
      </div>

      {askMarkSent && quote.status === "draft" && (
        <MarkSentPrompt label="quote" onYes={() => setStatus("sent")} onNo={() => setAskMarkSent(false)} />
      )}

      {/* Next steps — schedule it and/or invoice it */}
      {shown !== "declined" && (
        <div className={`print:hidden mb-6 rounded-xl border p-4 ${quote.status === "approved" ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {quote.status === "approved" ? "Approved — next steps" : "Next steps"}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {quote.converted_job_id ? (
              <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5">
                <p className="text-sm font-semibold text-gray-900">✓ On the calendar</p>
                <p className="text-xs text-gray-500 truncate">
                  {job ? `${job.title} · ${formatInvoiceDate(job.date)}` : "Scheduled as a job"}
                </p>
              </div>
            ) : (
              <Link
                href={`/admin/calendar?fromQuote=${id}`}
                className="rounded-lg bg-navy-600 hover:bg-navy-700 text-white text-sm font-semibold px-3 py-2.5 text-center"
              >
                Schedule as job
              </Link>
            )}
            {quote.converted_invoice_id ? (
              <Link
                href={`/admin/invoices/${quote.converted_invoice_id}`}
                className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-gray-900">✓ Invoiced</p>
                <p className="text-xs text-navy-600">View invoice {invoiceNumber ?? ""} →</p>
              </Link>
            ) : (
              <Link
                href={`/admin/invoices/new?fromQuote=${id}`}
                className="rounded-lg border border-navy-300 text-navy-600 hover:bg-navy-50 text-sm font-semibold px-3 py-2.5 text-center"
              >
                Create invoice from this quote
              </Link>
            )}
          </div>
        </div>
      )}

      <DocumentSheet doc={doc} logoUrl={logoUrl} />

      <div className="mt-6 space-y-4">
        <PaymentsCard kind="quote" docId={id} total={total} onChange={() => reload()} />
        <ExpensesCard quoteId={id} isPrivate />
      </div>
    </div>
  );
}
