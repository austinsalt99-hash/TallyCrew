"use client";

import { useState, useSyncExternalStore } from "react";
import type { DocumentModel } from "./documentModel";
import { buildDocumentPdf } from "@/lib/invoicePdf";
import { canShareWeb, savePdf, sharePdfWeb } from "@/lib/sharePdf";

// Device file-share support never changes mid-session, so a no-op subscribe is fine —
// this only exists to read it without a server/client hydration mismatch (the server
// always reports false, since it has no navigator).
function subscribeNever() {
  return () => {};
}

// Save PDF / Share buttons for a quote or invoice. onExported runs after the
// file was actually saved or shared (not when the share sheet is cancelled).
export default function PdfButtons({
  doc, logoUrl, onExported,
}: {
  doc: DocumentModel;
  logoUrl: string | null;
  onExported?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canShare = useSyncExternalStore(subscribeNever, canShareWeb, () => false);

  // window.print() does nothing inside the iOS app or Safari, so build the PDF ourselves.
  async function withPdf(action: (bytes: Uint8Array, filename: string) => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      const bytes = await buildDocumentPdf(doc, logoUrl);
      const prefix = doc.kind === "quote" ? "Quote" : "Invoice";
      const safeNumber = (doc.number || prefix.toLowerCase()).replace(/[^A-Za-z0-9_-]+/g, "-");
      await action(bytes, `${prefix}-${safeNumber}.pdf`);
      onExported?.();
    } catch (err) {
      // Closing the share sheet rejects with an abort/cancel error. That isn't a failure.
      const message = err instanceof Error ? `${err.name} ${err.message}` : "";
      if (/abort|cancel/i.test(message)) return;
      console.error("Save PDF failed:", err);
      setError("Couldn't create the PDF. If this keeps happening, update the TallyCrew app and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => withPdf(savePdf)}
        disabled={busy}
        className="bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2 text-sm"
      >
        {busy ? "Preparing PDF…" : "Save PDF"}
      </button>
      {canShare && (
        <button
          onClick={() => withPdf(sharePdfWeb)}
          disabled={busy}
          title="Share without saving — AirDrop, Mail, Messages, etc."
          className="border border-navy-300 text-navy-600 hover:bg-navy-50 disabled:opacity-60 font-semibold rounded-xl px-4 py-2 text-sm"
        >
          Share
        </button>
      )}
      {error && <p className="basis-full text-sm text-red-600">{error}</p>}
    </>
  );
}

// Shown after a draft is saved/shared as a PDF, since sending it happens
// outside the app (the admin attaches it to their own email or text).
export function MarkSentPrompt({ label, onYes, onNo }: { label: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="print:hidden mb-4 flex items-center gap-3 flex-wrap bg-navy-50 border border-navy-100 rounded-xl px-4 py-3">
      <p className="text-sm text-navy-800 flex-1 min-w-[180px]">Did you send this {label} to the client? Mark it as sent to keep track.</p>
      <button onClick={onYes} className="bg-navy-600 hover:bg-navy-700 text-white text-sm font-semibold rounded-lg px-3 py-1.5">Mark as sent</button>
      <button onClick={onNo} className="text-sm text-gray-500 hover:text-gray-700">Not yet</button>
    </div>
  );
}
