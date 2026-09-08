// Pure helpers for the per-table self-order QR (issue #131). Kept free of
// React/qrcode so the URL-building logic is unit-testable without mocking
// the qrcode package - mirrors floor-plan-state.ts's split between logic
// and UI. Must match the guest entry route exactly:
// src/app/qr/t/[outletId]/[tableId]/page.tsx.
import type { PrintQrCard } from "./qr-print-sheet";

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

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * "Download QR sheet" (issue #161): one self-contained HTML file with a
 * cut-out card per table, so the sheet can go to a print shop or a designer
 * without the app. Inline styles only - the file has to render on its own.
 * Table/floor labels are owner input, so they're escaped; qrDataUrl is our
 * own base64 PNG and needs no escaping.
 */
export function qrSheetHtml(cards: readonly PrintQrCard[]): string {
  const items = cards
    .map(
      (card) => `<figure>
  <p class="floor">${escapeHtml(card.floorName)}</p>
  <h2>${escapeHtml(card.table.label)}</h2>
  <img src="${card.qrDataUrl}" alt="Self-order QR code for ${escapeHtml(card.table.label)}">
  <figcaption>Scan to order<small>${escapeHtml(card.url)}</small></figcaption>
</figure>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Table QR codes</title>
<style>
  @page{margin:10mm}
  html{color-scheme:light}
  body{font-family:system-ui,sans-serif;margin:0;padding:12mm;background:#fff;color:#111}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(64mm,1fr));gap:8mm}
  figure{margin:0;padding:6mm;border:1px dashed #999;border-radius:4mm;text-align:center;break-inside:avoid}
  .floor{margin:0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#666}
  h2{margin:2mm 0 4mm;font-size:20px}
  img{width:48mm;height:48mm}
  figcaption{margin-top:3mm;font-weight:600}
  small{display:block;margin-top:1mm;font-weight:400;font-size:9px;color:#666;word-break:break-all}
</style></head><body><main>
${items}
</main></body></html>
`;
}
