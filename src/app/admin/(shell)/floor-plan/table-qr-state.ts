// Helpers for the per-table self-order QR (issue #131) and its downloadable
// forms (issue #161's HTML sheet, issue #175's ZIP-of-PNGs and customisable
// template). The URL/filename helpers stay free of React/qrcode so they're
// unit-testable without mocking the qrcode package - mirrors
// floor-plan-state.ts's split between logic and UI. renderTableQrPng is the
// one exception: it *is* the shared PNG-generation helper (issue #175), used
// by both the per-table "Download PNG" button (table-qr-dialog.tsx) and the
// ZIP sheet (floor-plan.tsx), so it has to own the qrcode + canvas work.
// Must match the guest entry route exactly:
// src/app/qr/t/[outletId]/[tableId]/page.tsx.
import QRCode from "qrcode";
import type { PrintQrCard } from "./qr-print-sheet";
import { QR_CARD_SIZE_MM, type QrSheetTemplate } from "./qr-sheet-template";

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

/** Lowercase, dash-separated, filesystem/URL-safe; empty input falls back to "item" rather than producing a blank path segment. */
export function slug(text: string): string {
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "item";
}

/** `("Ground Floor", "T-1")` → `ground-floor-t-1-qr.png`, one ZIP entry name per table (issue #175). */
export function qrZipPngFilename(floorName: string, tableLabel: string): string {
  return `${slug(floorName)}-${slug(tableLabel)}-qr.png`;
}

/** Saves `href` (a data: or blob: URL) as `filename` via a synthetic anchor click - the same shape as reports-state.ts's downloadReportExport. */
export function downloadUrl(filename: string, href: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * "Download QR sheet" (issue #161, templated per #175): one self-contained
 * HTML file with a cut-out card per table, so the sheet can go to a print
 * shop or a designer without the app. Inline styles only - the file has to
 * render on its own. Table/floor labels and the template's owner-entered
 * heading/instruction are escaped; qrDataUrl is our own base64 PNG and needs
 * no escaping.
 */
export function qrSheetHtml(cards: readonly PrintQrCard[], template: QrSheetTemplate): string {
  const qrMm = QR_CARD_SIZE_MM[template.cardSize];
  const items = cards
    .map(
      (card) => `<figure>
  ${template.showFloorName ? `<p class="floor">${escapeHtml(card.floorName)}</p>` : ""}
  ${template.showTableLabel ? `<h2>${escapeHtml(card.table.label)}</h2>` : ""}
  <img src="${card.qrDataUrl}" alt="Self-order QR code for ${escapeHtml(card.table.label)}" style="width:${qrMm}mm;height:${qrMm}mm">
  ${template.showUrl ? `<small>${escapeHtml(card.url)}</small>` : ""}
</figure>`,
    )
    .join("\n");
  const header =
    template.heading || template.instruction
      ? `<header>${template.heading ? `<h1>${escapeHtml(template.heading)}</h1>` : ""}${template.instruction ? `<p>${escapeHtml(template.instruction)}</p>` : ""}</header>`
      : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Table QR codes</title>
<style>
  @page{margin:10mm}
  html{color-scheme:light}
  body{font-family:system-ui,sans-serif;margin:0;padding:12mm;background:#fff;color:#111}
  header{text-align:center;margin-bottom:8mm}
  header h1{margin:0;font-size:22px}
  header p{margin:2mm 0 0;color:#666;font-size:13px}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(64mm,1fr));gap:8mm}
  figure{margin:0;padding:6mm;border:1px dashed #999;border-radius:4mm;text-align:center;break-inside:avoid}
  .floor{margin:0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#666}
  h2{margin:2mm 0 4mm;font-size:20px}
  small{display:block;margin-top:3mm;font-weight:400;font-size:9px;color:#666;word-break:break-all}
</style></head><body>${header}<main>
${items}
</main></body></html>
`;
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
 * by both the per-table "Download PNG" button (table-qr-dialog.tsx) and the
 * ZIP sheet (floor-plan.tsx) - the one PNG-generation code path for both.
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
  canvas.height = headerRows.length * rowHeight + padding + QR_DOWNLOAD_PX + padding + footerRows.length * rowHeight;

  // Checked (and the plain QR returned) before touching Image at all - an
  // environment where 2d canvas contexts aren't available (jsdom without the
  // optional `canvas` package included) can't decode an <img> either, so
  // there's no point starting a load that would never resolve.
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  const qrImage = await loadImage(qrDataUrl);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let y = rowHeight / 2;
  for (const row of headerRows) {
    ctx.font = row.font;
    ctx.fillText(row.text, canvas.width / 2, y);
    y += rowHeight;
  }

  const qrY = headerRows.length * rowHeight + padding;
  ctx.drawImage(qrImage, 0, qrY, QR_DOWNLOAD_PX, QR_DOWNLOAD_PX);

  y = qrY + QR_DOWNLOAD_PX + padding + rowHeight / 2;
  for (const row of footerRows) {
    ctx.font = row.font;
    ctx.fillText(row.text, canvas.width / 2, y);
    y += rowHeight;
  }

  return canvas.toDataURL("image/png");
}
