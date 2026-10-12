import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import type { ColumnDef } from "@/app/admin/invoices/_components/invoiceFormat";
import { computeTotals, formatInvoiceCell, formatInvoiceDate, formatMoney, lineDescription } from "@/app/admin/invoices/_components/invoiceFormat";
import type { DocumentModel } from "@/app/admin/invoices/_components/documentModel";

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

function isPngBytes(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebpBytes(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
  );
}

// pdf-lib can only embed PNG and JPEG directly, but the logo upload (Settings →
// Appearance, src/app/admin/settings/page.tsx) accepts WEBP and SVG too. Either
// of those loaded fine in the <img> preview there but silently failed to embed here — this
// re-rasterizes anything that isn't already PNG/JPEG to PNG first, by drawing it
// through a canvas, which the browser can do for any format it can natively
// decode.
async function rasterizeToPng(bytes: Uint8Array, contentType: string): Promise<Uint8Array | null> {
  const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: contentType }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image failed to decode"));
      el.src = blobUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 170;
    canvas.height = img.naturalHeight || 44;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return pngBlob ? new Uint8Array(await pngBlob.arrayBuffer()) : null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function loadLogo(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());

    if (isPngBytes(bytes)) return await doc.embedPng(bytes);
    if (isJpegBytes(bytes)) return await doc.embedJpg(bytes);

    // Not already PNG/JPEG — figure out what it is (trust the server's
    // content-type first, fall back to sniffing) so the browser knows how to
    // decode it, then rasterize and embed that instead.
    const contentType = res.headers.get("content-type") || (isWebpBytes(bytes) ? "image/webp" : "image/svg+xml");
    const pngBytes = await rasterizeToPng(bytes, contentType);
    return pngBytes ? await doc.embedPng(pngBytes) : null;
  } catch {
    // A logo that won't load shouldn't stop the invoice from saving.
    return null;
  }
}

// Builds the PDF for a quote or an invoice (see documentModel.ts).
export async function buildDocumentPdf(doc0: DocumentModel, logoUrl: string | null): Promise<Uint8Array> {
  const columns = doc0.columns;
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
  if (doc0.companyName) {
    text(doc0.companyName, MARGIN, leftY - 14, 15, bold, INK);
    leftY -= 22;
  }
  for (const line of (doc0.companyAddress ?? "").split("\n").filter(Boolean)) {
    text(line, MARGIN, leftY - 10, 9, font, MUTED);
    leftY -= 13;
  }

  const right = PAGE_W - MARGIN;
  rightText(doc0.heading, right, y - 24, 26, bold, NAVY);
  rightText(`${doc0.numberLabel}: ${doc0.number || "—"}`, right, y - 42, 9.5);
  rightText(`Date: ${doc0.date ? formatInvoiceDate(doc0.date) : "—"}`, right, y - 55, 9.5);
  let rightY = y - 55;
  for (const line of doc0.extraHeaderLines) {
    rightY -= 13;
    rightText(line, right, rightY, 9.5);
  }

  let cursor = Math.min(leftY, rightY - 5) - 22;

  // ── Bill to / Prepared for ──────────────────────────────────────────────
  text(doc0.partyLabel.toUpperCase(), MARGIN, cursor, 7.5, bold, MUTED);
  cursor -= 16;
  text(doc0.clientName || "—", MARGIN, cursor, 12, bold, INK);
  cursor -= 16;
  for (const line of doc0.clientLines) {
    text(line, MARGIN, cursor, 9, font, MUTED);
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
  for (const item of doc0.lineItems) {
    const cellLines = tableCols.map((c, i) =>
      wrap(formatInvoiceCell(c, item), cellFont(c), 9, widths[i] - CELL_PAD * 2),
    );
    const mainLines = Math.max(1, ...cellLines.map((l) => l.length));
    // Title (bold) and description run full-width above the numbers, as on screen
    const titleLines = item.title?.trim() ? wrap(item.title, bold, 9.5, CONTENT_W - CELL_PAD * 2) : [];
    const desc = lineDescription(item);
    const descLines = showDescription && desc ? wrap(desc, font, 8.5, CONTENT_W - CELL_PAD * 2) : [];
    const headHeight = titleLines.length * 12 + descLines.length * 10.5;
    const rowHeight = headHeight + (headHeight > 0 ? 3 : 0) + mainLines * 11 + 14;

    if (y - rowHeight < MARGIN) {
      newPage();
      drawHeader();
    }

    let rowY = y;
    titleLines.forEach((line) => {
      text(line, MARGIN + CELL_PAD, rowY - 10, 9.5, bold, INK);
      rowY -= 12;
    });
    descLines.forEach((line) => {
      text(line, MARGIN + CELL_PAD, rowY - 9, 8.5, font, MUTED);
      rowY -= 10.5;
    });
    if (headHeight > 0) rowY -= 3;

    const top = rowY;
    tableCols.forEach((c, i) => {
      cellLines[i].forEach((line, li) => {
        const baseline = top - 9 - li * 11;
        if (RIGHT_ALIGNED.has(c.type)) rightText(line, xs[i] + widths[i] - CELL_PAD, baseline, 9, cellFont(c));
        else text(line, xs[i] + CELL_PAD, baseline, 9, cellFont(c));
      });
    });
    rowY = top - mainLines * 11 - 2;

    y = rowY - 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 4;
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const totals = computeTotals(doc0.lineItems, doc0.taxRate);
  const balance = Math.max(0, Math.round((totals.total - doc0.amountPaid) * 100) / 100);
  const LABEL_RIGHT = PAGE_W - MARGIN - 90;
  const sideRow = (label: string, value: string, f: PDFFont = font, color = INK) => {
    rightText(value, PAGE_W - MARGIN, y, 10, f, color);
    rightText(label, LABEL_RIGHT, y, 10, f, color);
    y -= 15;
  };
  if (y - 110 < MARGIN) newPage();
  y -= 8;
  rule(1.5, HEAVY);
  y -= 18;
  if (totals.taxRate > 0) {
    sideRow("Subtotal", formatMoney(totals.subtotal));
    sideRow(`${doc0.taxLabel?.trim() || "Tax"} (${totals.taxRate}%)`, formatMoney(totals.taxAmount));
    y -= 3;
  }
  const totalText = formatMoney(totals.total);
  rightText(totalText, PAGE_W - MARGIN, y, 13, bold, NAVY);
  rightText("Total", LABEL_RIGHT, y, 11, bold);
  y -= 18;
  if (doc0.amountPaid > 0) {
    sideRow("Paid to date", `-${formatMoney(doc0.amountPaid)}`, font, MUTED);
    sideRow("Balance due", formatMoney(balance), bold, INK);
  }
  if (doc0.depositNote) {
    rightText(doc0.depositNote, PAGE_W - MARGIN, y, 9.5, bold, INK);
    y -= 15;
  }
  y -= 12;

  // ── Notes / terms ───────────────────────────────────────────────────────
  const section = (heading: string, body: string | null | undefined) => {
    if (!body?.trim()) return;
    const lines = wrap(body, font, 9, CONTENT_W);
    if (y - 30 < MARGIN) newPage();
    rule(0.5, RULE);
    y -= 14;
    text(heading, MARGIN, y, 7.5, bold, MUTED);
    y -= 14;
    for (const line of lines) {
      if (y - 12 < MARGIN) newPage();
      text(line, MARGIN, y, 9, font, INK);
      y -= 12;
    }
    y -= 6;
  };
  section("NOTES", doc0.notes);
  section("TERMS", doc0.terms);

  // ── Draft marker (drafts only, matching the on-screen view) ─────────────
  // Drawn as a footer on the last page so it never starts a page of its own.
  if (doc0.isDraft) {
    const label = "— Draft —";
    text(label, (PAGE_W - font.widthOfTextAtSize(clean(label), 8)) / 2, 28, 8, font, MUTED);
  }

  return doc.save();
}
