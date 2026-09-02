"use client";

// "Print QR sheet" (issue #131): one card per table on this outlet, for
// sticking a printed QR on the physical table. An in-page print stylesheet
// (Tailwind's print: variant) rather than a dedicated route - the admin
// shell's sidebar/toolbar/outlet-switcher chrome would print alongside a
// route-based page too, and this needs no new route, layout, or
// outlet-id-from-search-params plumbing. Cards render from pre-generated
// data: URLs (see floor-plan.tsx's handlePrintQrSheet) rather than each
// generating its own via useQrDataUrl, so window.print() never races a
// still-pending QRCode.toDataURL() promise for a table further down the list.
export interface PrintQrCard {
  table: { id: string; label: string };
  floorName: string;
  url: string;
  qrDataUrl: string;
}

export function QrPrintSheet({ cards }: Readonly<{ cards: readonly PrintQrCard[] }>) {
  return (
    <div data-testid="qr-print-sheet" className="hidden print:block">
      {cards.map((card) => (
        <div
          key={card.table.id}
          data-testid={`qr-print-card-${card.table.id}`}
          className="mb-6 flex flex-col items-center gap-2 break-inside-avoid border-b border-dashed border-border/60 pb-6 text-center last:border-0"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.floorName}</p>
          <p className="text-lg font-semibold">{card.table.label}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not something next/image's optimizer can (or needs to) handle */}
          <img src={card.qrDataUrl} alt={`Self-order QR code for ${card.table.label}`} width={200} height={200} />
          <p className="text-xs">{card.url}</p>
        </div>
      ))}
    </div>
  );
}
