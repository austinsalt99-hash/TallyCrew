"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef, InvoiceLineItemLike } from "../_components/invoiceFormat";
import { computeTotals } from "../_components/invoiceFormat";
import { invoiceToDocument } from "../_components/documentModel";
import DocumentSheet from "../_components/DocumentSheet";
import PdfButtons, { MarkSentPrompt } from "../_components/PdfButtons";
import PaymentsCard from "@/components/PaymentsCard";
import ExpensesCard from "@/components/ExpensesCard";

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  date_from: string;
  date_to: string;
  invoice_date: string;
  company_name?: string;
  company_address?: string;
  line_items: (InvoiceLineItemLike & { sourceJobId?: string })[];
  column_config?: ColumnDef[];
  total: number;
  notes?: string;
  tax_label?: string | null;
  tax_rate?: number | null;
  status: "draft" | "sent" | "partial" | "paid";
  paid_at?: string | null;
  source_quote_id?: string | null;
  amount_paid: number;
}

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-navy-100 text-navy-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

const statusLabel: Record<string, string> = { draft: "Draft", sent: "Sent", partial: "Partly paid", paid: "Paid" };

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [askMarkSent, setAskMarkSent] = useState(false);
  const [paymentsKey, setPaymentsKey] = useState(0);
  const [sourceQuote, setSourceQuote] = useState<{ id: string; quote_number: string | null } | null>(null);

  function reload() {
    return fetch(`/api/invoices/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setInvoice(data); setLoading(false); });
  }

  useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/company", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setLogoUrl(data.invoice_logo_url ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!invoice?.source_quote_id) return;
    fetch(`/api/quotes/${invoice.source_quote_id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => setSourceQuote(q ? { id: q.id, quote_number: q.quote_number } : null));
  }, [invoice?.source_quote_id]);

  async function setStatus(status: "draft" | "sent") {
    await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    setAskMarkSent(false);
    await reload();
  }

  // "Mark as Paid" records one payment for whatever is still owed
  async function markPaid() {
    if (!invoice) return;
    const balance = Math.round((computeTotals(invoice.line_items, invoice.tax_rate).total - invoice.amount_paid) * 100) / 100;
    if (balance <= 0) return;
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ invoice_id: id, amount: balance, paid_on: todayStr(), method: "other", note: "Marked as paid" }),
    });
    setPaymentsKey((k) => k + 1);
    await reload();
  }

  async function deleteInvoice() {
    await fetch(`/api/invoices/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    router.push("/admin/invoices");
  }

  if (loading) return <p className="text-gray-500">Loading invoice...</p>;
  if (!invoice) return <p className="text-red-500">Invoice not found.</p>;

  const doc = invoiceToDocument(invoice);
  const total = computeTotals(invoice.line_items, invoice.tax_rate).total;
  const linkedJobIds = [...new Set(invoice.line_items.map((li) => li.sourceJobId).filter(Boolean))] as string[];

  return (
    <div className="max-w-4xl">
      {/* Admin controls — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/admin/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[invoice.status] ?? statusBadge.draft}`}>
          {statusLabel[invoice.status] ?? invoice.status}
        </span>
        <div className="flex-1" />
        <Link
          href={`/admin/invoices/${id}/edit`}
          className="text-sm border border-navy-400 text-navy-600 hover:bg-navy-50 rounded-lg px-3 py-1.5 font-semibold"
        >
          ✏ Edit Invoice
        </Link>
        {invoice.status === "sent" && (
          <button
            onClick={() => setStatus("draft")}
            className="text-sm border border-gray-300 text-gray-500 hover:bg-gray-50 rounded-lg px-3 py-1.5 font-medium"
          >
            Revert to Draft
          </button>
        )}
        {invoice.status === "draft" && (
          <button
            onClick={() => setStatus("sent")}
            className="text-sm border border-navy-300 text-navy-600 hover:bg-navy-50 rounded-lg px-3 py-1.5 font-medium"
          >
            Mark as Sent
          </button>
        )}
        {invoice.status !== "paid" && total > 0 && (
          <button
            onClick={markPaid}
            className="text-sm border border-green-300 text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 font-medium"
          >
            Mark as Paid
          </button>
        )}
        <PdfButtons doc={doc} logoUrl={logoUrl} onExported={() => { if (invoice.status === "draft") setAskMarkSent(true); }} />
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">
              Delete this invoice?{invoice.amount_paid > 0 ? " Payments recorded only on it are removed too." : ""}
            </span>
            <button onClick={deleteInvoice} className="text-red-600 font-semibold hover:text-red-700">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-gray-400">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 hover:text-red-700">
            Delete
          </button>
        )}
      </div>

      {askMarkSent && invoice.status === "draft" && (
        <MarkSentPrompt label="invoice" onYes={() => setStatus("sent")} onNo={() => setAskMarkSent(false)} />
      )}

      {sourceQuote && (
        <p className="print:hidden -mt-2 mb-4 text-sm text-gray-500">
          Made from <Link href={`/admin/quotes/${sourceQuote.id}`} className="text-navy-600 font-semibold hover:underline">
            quote {sourceQuote.quote_number ?? ""}
          </Link>
        </p>
      )}

      <DocumentSheet doc={doc} logoUrl={logoUrl} />

      <div className="mt-6 space-y-4">
        <PaymentsCard kind="invoice" docId={id} total={total} refreshKey={paymentsKey} onChange={() => reload()} />
        <ExpensesCard invoiceId={id} jobIds={linkedJobIds} />
      </div>
    </div>
  );
}
