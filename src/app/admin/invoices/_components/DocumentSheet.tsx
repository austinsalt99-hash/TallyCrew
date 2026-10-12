"use client";

import { Fragment } from "react";
import type { DocumentModel } from "./documentModel";
import { computeTotals, formatInvoiceCell, formatInvoiceDate, formatMoney, invoiceColHeaderClass, lineDescription } from "./invoiceFormat";

// Subtotal / tax / total / paid / balance rows. Used by the read-only sheet
// below and by the live preview in the editor.
export function DocumentTotalsRows({
  items, taxLabel, taxRate, amountPaid = 0, depositNote,
}: {
  items: { amount: number | string }[];
  taxLabel?: string | null;
  taxRate?: number | string | null;
  amountPaid?: number;
  depositNote?: string | null;
}) {
  const t = computeTotals(items, taxRate);
  const balance = Math.max(0, Math.round((t.total - amountPaid) * 100) / 100);
  return (
    <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
      {t.taxRate > 0 && (
        <>
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{formatMoney(t.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{taxLabel?.trim() || "Tax"} ({t.taxRate}%)</span><span>{formatMoney(t.taxAmount)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between font-bold text-base pt-1">
        <span className="text-gray-700">Total</span><span className="text-navy-600">{formatMoney(t.total)}</span>
      </div>
      {amountPaid > 0 && (
        <>
          <div className="flex justify-between text-gray-500">
            <span>Paid to date</span><span>−{formatMoney(amountPaid)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Balance due</span><span>{formatMoney(balance)}</span>
          </div>
        </>
      )}
      {depositNote && <p className="text-right text-sm font-semibold text-gray-800 pt-1">{depositNote}</p>}
    </div>
  );
}

// Read-only, printable quote or invoice.
export default function DocumentSheet({ doc, logoUrl }: { doc: DocumentModel; logoUrl: string | null }) {
  const visibleCols = doc.columns.filter((c) => c.visible);
  // Description runs full-width below each row instead of squeezing into its own
  // narrow column — matches the live preview, and keeps long text from overflowing.
  const tableCols = visibleCols.filter((c) => c.type !== "description");
  const showDescription = visibleCols.some((c) => c.type === "description");
  const colCount = Math.max(1, tableCols.length);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-8 print:border-0 print:rounded-none print:shadow-none">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6 sm:mb-8">
        <div>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="max-h-14 max-w-[220px] object-contain mb-2" />
          )}
          {doc.companyName && <div className="text-xl font-bold text-gray-900 mb-1">{doc.companyName}</div>}
          {doc.companyAddress && <div className="text-sm text-gray-500 whitespace-pre-line">{doc.companyAddress}</div>}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-navy-600 mb-1">{doc.heading}</div>
          <div className="text-sm text-gray-600">
            <div><span className="font-medium">{doc.numberLabel}:</span> {doc.number || "—"}</div>
            <div><span className="font-medium">Date:</span> {doc.date ? formatInvoiceDate(doc.date) : "—"}</div>
            {doc.extraHeaderLines.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
      </div>

      {/* Bill to / Prepared for */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{doc.partyLabel}</div>
        <div className="text-lg font-semibold text-gray-900">{doc.clientName || "—"}</div>
        {doc.clientLines.map((line) => <div key={line} className="text-sm text-gray-500">{line}</div>)}
      </div>

      {/* Phone: each line as a stacked card so nothing needs sideways scrolling */}
      <div className="sm:hidden print:hidden mb-6">
        {doc.lineItems.map((item, i) => {
          const colOf = (type: string) => tableCols.find((c) => c.type === type);
          const dateCol = colOf("date");
          const employeeCol = colOf("employee");
          const amountCol = colOf("amount");
          const detailCols = tableCols.filter((c) => !["date", "employee", "amount", "description"].includes(c.type));
          return (
            <div key={i} className="py-3 space-y-1 border-b border-gray-100">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 text-xs text-gray-600">
                  {dateCol && <div>{formatInvoiceCell(dateCol, item)}</div>}
                  {employeeCol && <div className="text-sm text-gray-700">{formatInvoiceCell(employeeCol, item)}</div>}
                </div>
                {amountCol && <div className="shrink-0 text-sm font-semibold text-gray-900">{formatInvoiceCell(amountCol, item)}</div>}
              </div>
              {item.title && <div className="text-sm font-semibold text-gray-900">{item.title}</div>}
              {showDescription && lineDescription(item) && <div className="text-sm text-gray-700">{lineDescription(item)}</div>}
              {detailCols.map((col) => (
                <div key={col.id} className="flex justify-between items-baseline gap-3 text-xs text-gray-500">
                  <span>{col.label}</span>
                  <span className="text-right text-sm text-gray-700">{formatInvoiceCell(col, item)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Line items — table from 640px up, and always when printing */}
      <div className="hidden sm:block print:block overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              {tableCols.map((col) => <th key={col.id} className={invoiceColHeaderClass(col)}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {doc.lineItems.map((item, i) => (
              <Fragment key={i}>
                {(item.title || (showDescription && lineDescription(item))) && (
                  <tr>
                    <td colSpan={colCount} className="pt-2 pr-4">
                      {item.title && <div className="font-semibold text-gray-900">{item.title}</div>}
                      {showDescription && lineDescription(item) && <div className="text-xs text-gray-600">{lineDescription(item)}</div>}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-gray-100">
                  {tableCols.map((col) => (
                    <td
                      key={col.id}
                      className={`py-2 pr-4 last:pr-0 text-gray-700 ${
                        col.type === "amount" ? "text-right font-medium text-gray-900" : col.type === "hours" || col.type === "rate" ? "text-right text-gray-500" : ""
                      }`}
                    >
                      {formatInvoiceCell(col, item)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t-2 border-gray-200 pt-3 mb-8">
        <DocumentTotalsRows items={doc.lineItems} taxLabel={doc.taxLabel} taxRate={doc.taxRate}
          amountPaid={doc.amountPaid} depositNote={doc.depositNote} />
      </div>

      {doc.notes && (
        <div className="border-t border-gray-100 pt-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-sm text-gray-600 whitespace-pre-line">{doc.notes}</p>
        </div>
      )}
      {doc.terms && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Terms</div>
          <p className="text-sm text-gray-600 whitespace-pre-line">{doc.terms}</p>
        </div>
      )}

      {doc.isDraft && (
        <div className="print:hidden mt-6 text-center text-xs text-gray-300 uppercase tracking-widest">— Draft —</div>
      )}
    </div>
  );
}
