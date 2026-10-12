"use client";

// "Print QR sheet" (issue #131, templated per #175): one card per table on
// this outlet, for sticking a printed QR on the physical table. An in-page
// print stylesheet (Tailwind's print: variant) rather than a dedicated
// route - the admin shell's sidebar/toolbar/outlet-switcher chrome would
// print alongside a route-based page too, and this needs no new route,
// layout, or outlet-id-from-search-params plumbing. Cards render from
// pre-generated data: URLs (see floor-plan.tsx's handlePrintQrSheet) rather
// than each generating its own via useQrDataUrl, so window.print() never
// races a still-pending QRCode.toDataURL() promise for a table further down
// the list.
import { QR_CARD_SIZE_PX, type QrSheetTemplate } from "./qr-sheet-template";

export interface PrintQrCard {
  table: { id: string; label: string };
  floorName: string;
  url: string;
  qrDataUrl: string;
}

export function QrPrintSheet({ cards, template }: Readonly<{ cards: readonly PrintQrCard[]; template: QrSheetTemplate }>) {
  const qrPx = QR_CARD_SIZE_PX[template.cardSize];
  return (
    // Off-canvas on screen (not display:none) so every <img> is laid out and
    // decoded before window.print(): Chrome's print preview can otherwise
    // paint a display:none image as an empty box. Restored to flow in print.
    // CU-8: black text on the white page, and as many cards per row as fit (it printed two per A4 page).
    <div data-testid="qr-print-sheet" className="fixed top-0 -left-full w-full text-black print:static print:w-auto" aria-hidden="true">
      {/* PE-20: A4 with small margins, so "Save as PDF" gives one sheet of several cards per page. */}
      <style>{"@page{size:A4;margin:10mm}"}</style>
      {(template.heading || template.instruction) && (
        <div data-testid="qr-print-sheet-header" className="mb-6 text-center">
          {template.heading && <h1 className="text-xl font-semibold">{template.heading}</h1>}
          {template.instruction && <p className="text-sm text-neutral-700">{template.instruction}</p>}
        </div>
      )}
      <div data-testid="qr-print-grid" className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${qrPx + 32}px, 1fr))` }}>
      {cards.map((card) => (
        <div
          key={card.table.id}
          data-testid={`qr-print-card-${card.table.id}`}
          className="flex flex-col items-center gap-2 break-inside-avoid rounded-lg border border-dashed border-neutral-400 p-4 text-center"
        >
          {template.showFloorName && <p className="text-xs uppercase tracking-wide text-neutral-700">{card.floorName}</p>}
          {template.showTableLabel && <p className="text-2xl font-bold text-black">{card.table.label}</p>}
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not something next/image's optimizer can (or needs to) handle */}
          <img src={card.qrDataUrl} alt={`Self-order QR code for ${card.table.label}`} width={qrPx} height={qrPx} />
          {template.showUrl && <p className="break-all text-[10px] text-neutral-700">{card.url}</p>}
        </div>
      ))}
      </div>
    </div>
  );
}
