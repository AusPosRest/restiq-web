// Helpers for the per-table self-order QR (issue #131) and its downloadable
// PNG (issue #175's customisable template; the whole sheet is printed or saved
// as a PDF from the browser instead, PE-20). The URL/filename helpers stay free of React/qrcode so they're
// unit-testable without mocking the qrcode package - mirrors
// floor-plan-state.ts's split between logic and UI. renderTableQrPng is the
// one exception: it is the PNG-generation helper behind the per-table
// "Download PNG" button (table-qr-dialog.tsx), so it owns the qrcode + canvas work.
// Must match the guest entry route exactly:
// src/app/qr/t/[outletId]/[tableId]/page.tsx.
import QRCode from "qrcode";
import type { QrSheetTemplate } from "./qr-sheet-template";

/** Matches TableQrDialog's QR_DOWNLOAD_PX (~87mm at 300dpi) - sticker-sized when handed to a print shop or used standalone (issues #161, #175). */
export const QR_DOWNLOAD_PX = 1024;
const QR_ERROR_CORRECTION_LEVEL = "M" as const;

export function guestOrderUrl(origin: string, outletId: string, tableId: string): string {
  return `${origin}/qr/t/${outletId}/${tableId}`;
}

/** `T-1` → `T-1-qr.png`; anything a filesystem might reject becomes `_`. */
export function qrPngFilename(label: string): string {
  return `${label.replace(/[^\w-]+/g, "_")}-qr.png`;
}

/** Saves `href` (a data: or blob: URL) as `filename` via a synthetic anchor click - the same shape as reports-state.ts's downloadReportExport. */
export function downloadUrl(filename: string, href: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load the generated QR image."));
    image.src = src;
  });
}

/**
 * Renders one table's self-order QR as a standalone PNG, with the template's
 * heading/instruction and this table's floor/label/url baked in underneath
 * so the image still makes sense once it's off the sheet (issue #175). Used
 * by the per-table "Download PNG" button (table-qr-dialog.tsx).
 * When every per-card toggle is off there's nothing to caption, so this
 * skips the canvas step entirely and returns the plain QR.
 */
export async function renderTableQrPng(table: { label: string }, floorName: string, url: string, template: QrSheetTemplate): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL, width: QR_DOWNLOAD_PX });
  if (!template.showTableLabel && !template.showFloorName && !template.showUrl) return qrDataUrl;

  const headerRows: Array<{ text: string; font: string }> = [];
  if (template.heading) headerRows.push({ text: template.heading, font: "bold 44px sans-serif" });
  if (template.instruction) headerRows.push({ text: template.instruction, font: "28px sans-serif" });
  const footerRows: Array<{ text: string; font: string }> = [];
  if (template.showFloorName) footerRows.push({ text: floorName, font: "26px sans-serif" });
  if (template.showTableLabel) footerRows.push({ text: table.label, font: "bold 40px sans-serif" });
  if (template.showUrl) footerRows.push({ text: url, font: "22px sans-serif" });

  const rowHeight = 60;
  const padding = 40;
  const canvas = document.createElement("canvas");
  canvas.width = QR_DOWNLOAD_PX;

  // Checked (and the plain QR returned) before touching Image at all - an
  // environment where 2d canvas contexts aren't available (jsdom without the
  // optional `canvas` package included) can't decode an <img> either, so
  // there's no point starting a load that would never resolve.
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  // PE-20 / CU-8: a long table link ran off both edges - every row now wraps to the image width.
  const maxWidth = QR_DOWNLOAD_PX - padding * 2;
  const lines = (rows: Array<{ text: string; font: string }>) =>
    rows.flatMap((row) => {
      ctx.font = row.font;
      return wrapText(row.text, maxWidth, (text) => ctx.measureText(text).width).map((text) => ({ text, font: row.font }));
    });
  const headerLines = lines(headerRows);
  const footerLines = lines(footerRows);
  // Setting the height resets the context, so it comes after measuring and before drawing.
  canvas.height = headerLines.length * rowHeight + padding + QR_DOWNLOAD_PX + padding + footerLines.length * rowHeight;

  const qrImage = await loadImage(qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let y = rowHeight / 2;
  for (const row of headerLines) {
    ctx.font = row.font;
    ctx.fillText(row.text, canvas.width / 2, y);
    y += rowHeight;
  }

  const qrY = headerLines.length * rowHeight + padding;
  ctx.drawImage(qrImage, 0, qrY, QR_DOWNLOAD_PX, QR_DOWNLOAD_PX);

  y = qrY + QR_DOWNLOAD_PX + padding + rowHeight / 2;
  for (const row of footerLines) {
    ctx.font = row.font;
    ctx.fillText(row.text, canvas.width / 2, y);
    y += rowHeight;
  }

  return canvas.toDataURL("image/png");
}

/** Splits `text` into lines no wider than `maxWidth` - at spaces where it can, mid-word (a URL) where it must. */
export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const out: string[] = [];
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (line && measure(next) > maxWidth) {
      const space = line.lastIndexOf(" ");
      if (space > 0 && char !== " ") {
        out.push(line.slice(0, space));
        line = line.slice(space + 1) + char;
      } else {
        out.push(line.trimEnd());
        line = char === " " ? "" : char;
      }
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}
