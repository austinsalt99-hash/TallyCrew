import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import type { ColumnDef, InvoiceLineItemLike } from "@/app/admin/invoices/_components/invoiceFormat";
import { formatInvoiceCell, formatInvoiceDate } from "@/app/admin/invoices/_components/invoiceFormat";

export interface PdfInvoice {
  invoice_number: string;
  client_name: string;
  date_from: string;
  date_to: string;
  invoice_date: string;
  company_name?: string;
  company_address?: string;
  notes?: string;
  status: string;
  line_items: InvoiceLineItemLike[];
}

// US Letter, in PDF points
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CELL_PAD = 6;

// Relative column widths. Columns are scaled to fill the page width.
const BASE_WIDTH: Record<ColumnDef["type"], number> = {
  date: 62, employee: 110, rate: 80, hours: 60, amount: 70, custom: 90, description: 0,
};
const RIGHT_ALIGNED = new Set<ColumnDef["type"]>(["rate", "hours", "amount"]);

// The built-in PDF fonts only cover WinAnsi characters. Anything else is swapped
// for "?" so the file still saves.
function clean(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…]/g, "?");
}

// Splits text into lines that fit maxWidth. Newlines are kept as paragraph breaks.
// A single word wider than the column is broken up by character.
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  // Split on newlines before cleaning, or the line breaks themselves get replaced with "?".
  for (const paragraph of text.split("\n").map(clean)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

async function loadLogo(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    // A logo that won't load shouldn't stop the invoice from saving.
    return null;
  }
}

export async function buildInvoicePdf(
  invoice: PdfInvoice,
  columns: ColumnDef[],
  logoUrl: string | null,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const NAVY = rgb(0x0a / 255, 0x11 / 255, 0x72 / 255); // navy-600
  const INK = rgb(0.12, 0.14, 0.18);
  const MUTED = rgb(0.42, 0.45, 0.5);
  const RULE = rgb(0.88, 0.9, 0.93);
  const HEAVY = rgb(0.75, 0.78, 0.82);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (s: string, x: number, baseline: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(clean(s), { x, y: baseline, size, font: f, color });
  const rightText = (s: string, rightX: number, baseline: number, size: number, f: PDFFont = font, color = INK) => {
    const t = clean(s);
    page.drawText(t, { x: rightX - f.widthOfTextAtSize(t, size), y: baseline, size, font: f, color });
  };
  const rule = (thickness: number, color: ReturnType<typeof rgb>) =>
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness, color });
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  // ── Header ──────────────────────────────────────────────────────────────
  let logoHeight = 0;
  const logo = logoUrl ? await loadLogo(doc, logoUrl) : null;
  if (logo) {
    const dims = logo.scaleToFit(170, 44);
    page.drawImage(logo, { x: MARGIN, y: y - dims.height, width: dims.width, height: dims.height });
    logoHeight = dims.height + 10;
  }

  let leftY = y - logoHeight;
  if (invoice.company_name) {
    text(invoice.company_name, MARGIN, leftY - 14, 15, bold, INK);
    leftY -= 22;
  }
  for (const line of (invoice.company_address ?? "").split("\n").filter(Boolean)) {
    text(line, MARGIN, leftY - 10, 9, font, MUTED);
    leftY -= 13;
  }

  const right = PAGE_W - MARGIN;
  rightText("INVOICE", right, y - 24, 26, bold, NAVY);
  rightText(`Invoice #: ${invoice.invoice_number || "—"}`, right, y - 42, 9.5);
  rightText(`Date: ${invoice.invoice_date ? formatInvoiceDate(invoice.invoice_date) : "—"}`, right, y - 55, 9.5);

  let cursor = Math.min(leftY, y - 60) - 22;

  // ── Bill to ─────────────────────────────────────────────────────────────
  text("BILL TO", MARGIN, cursor, 7.5, bold, MUTED);
  cursor -= 16;
  text(invoice.client_name || "—", MARGIN, cursor, 12, bold, INK);
  cursor -= 16;
  if (invoice.date_from || invoice.date_to) {
    const from = invoice.date_from ? formatInvoiceDate(invoice.date_from) : "—";
    const to = invoice.date_to ? formatInvoiceDate(invoice.date_to) : "—";
    text(`Work performed: ${from} – ${to}`, MARGIN, cursor, 9, font, MUTED);
    cursor -= 12;
  }
  y = cursor - 22;

  // ── Line items ──────────────────────────────────────────────────────────
  const visibleCols = columns.filter((c) => c.visible);
  const tableCols = visibleCols.filter((c) => c.type !== "description");
  const showDescription = visibleCols.some((c) => c.type === "description");
  const baseTotal = tableCols.reduce((s, c) => s + BASE_WIDTH[c.type], 0);
  const scale = baseTotal > 0 ? CONTENT_W / baseTotal : 1;
  const widths = tableCols.map((c) => BASE_WIDTH[c.type] * scale);
  const xs: number[] = [];
  let accX = MARGIN;
  for (const w of widths) {
    xs.push(accX);
    accX += w;
  }
  const cellFont = (c: ColumnDef) => (c.type === "amount" ? bold : font);

  const drawHeader = () => {
    tableCols.forEach((c, i) => {
      const label = c.label.toUpperCase();
      if (RIGHT_ALIGNED.has(c.type)) rightText(label, xs[i] + widths[i] - CELL_PAD, y - 9, 7.5, bold, MUTED);
      else text(label, xs[i] + CELL_PAD, y - 9, 7.5, bold, MUTED);
    });
    y -= 14;
    rule(1.5, HEAVY);
    y -= 4;
  };

  drawHeader();
  for (const item of invoice.line_items) {
    const cellLines = tableCols.map((c, i) =>
      wrap(formatInvoiceCell(c, item), cellFont(c), 9, widths[i] - CELL_PAD * 2),
    );
    const mainLines = Math.max(1, ...cellLines.map((l) => l.length));
    const descLines = showDescription ? wrap(item.description || "—", font, 8.5, CONTENT_W - CELL_PAD * 2) : [];
    const rowHeight = mainLines * 11 + 4 + descLines.length * 10.5 + 10;

    if (y - rowHeight < MARGIN) {
      newPage();
      drawHeader();
    }

    const top = y;
    tableCols.forEach((c, i) => {
      cellLines[i].forEach((line, li) => {
        const baseline = top - 9 - li * 11;
        if (RIGHT_ALIGNED.has(c.type)) rightText(line, xs[i] + widths[i] - CELL_PAD, baseline, 9, cellFont(c));
        else text(line, xs[i] + CELL_PAD, baseline, 9, cellFont(c));
      });
    });

    let rowY = top - mainLines * 11 - 2;
    descLines.forEach((line, li) => {
      text(line, MARGIN + CELL_PAD, rowY - 9 - li * 10.5, 8.5, font, MUTED);
    });
    rowY -= descLines.length * 10.5 + 2;

    y = rowY - 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 4;
  }

  // ── Total ───────────────────────────────────────────────────────────────
  const total = invoice.line_items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0);
  if (y - 60 < MARGIN) newPage();
  y -= 8;
  rule(1.5, HEAVY);
  y -= 18;
  const totalText = `$${total.toFixed(2)}`;
  rightText(totalText, PAGE_W - MARGIN, y, 13, bold, NAVY);
  rightText("Total", PAGE_W - MARGIN - bold.widthOfTextAtSize(clean(totalText), 13) - 16, y, 11, bold);
  y -= 30;

  // ── Notes ───────────────────────────────────────────────────────────────
  if (invoice.notes?.trim()) {
    const noteLines = wrap(invoice.notes, font, 9, CONTENT_W);
    if (y - 30 < MARGIN) newPage();
    rule(0.5, RULE);
    y -= 14;
    text("NOTES", MARGIN, y, 7.5, bold, MUTED);
    y -= 14;
    for (const line of noteLines) {
      if (y - 12 < MARGIN) newPage();
      text(line, MARGIN, y, 9, font, INK);
      y -= 12;
    }
  }

  // ── Draft marker (drafts only, matching the on-screen view) ─────────────
  // Drawn as a footer on the last page so it never starts a page of its own.
  if (invoice.status === "draft") {
    const label = "— Draft —";
    text(label, (PAGE_W - font.widthOfTextAtSize(clean(label), 8)) / 2, 28, 8, font, MUTED);
  }

  return doc.save();
}
