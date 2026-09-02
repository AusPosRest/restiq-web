"use client";

// Per-table self-order QR (issue #131): guests already order at
// /qr/t/<outletId>/<tableId> when the outlet has qr_ordering (see
// src/app/qr/t/[outletId]/[tableId]/page.tsx) - this dialog is the owner
// console's first way to actually see or print that URL. QR generation is
// local/offline via the zero-dependency `qrcode` package's toDataURL (this
// is an offline-first POS - no network round-trip to a QR image service),
// error-correction M per the issue. Copy affordance mirrors
// src/app/ops/(shell)/tenants/invite-link.tsx's pattern, reimplemented here
// rather than imported since the admin/ops route trees never import from
// each other (AD-4, see code-chip.tsx's file header for the same rule).
import { Dialog } from "radix-ui";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import type { DiningTableView } from "./floor-plan-state";
import { guestOrderUrl } from "./table-qr-state";

export const QR_SIZE_PX = 200;
export const QR_OPTIONS = { errorCorrectionLevel: "M" as const, width: QR_SIZE_PX };

/**
 * Generates a table's QR as a data: URL client-side - no separate hook file
 * for one caller shape used twice (here and the print sheet's batch
 * generation), just this and a Promise.all at the print call site. Every
 * caller keys its component by table id (see TableQrDialog below), so
 * `text` never actually changes within one mounted instance - no
 * stale-value reset needed on a change that can't happen.
 */
export function useQrDataUrl(text: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    void QRCode.toDataURL(text, QR_OPTIONS).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return dataUrl;
}

interface TableQrDialogProps {
  table: DiningTableView | null;
  outletId: string;
  qrOrderingEnabled: boolean | null;
  onClose: () => void;
}

export function TableQrDialog({ table, outletId, qrOrderingEnabled, onClose }: Readonly<TableQrDialogProps>) {
  return table ? <DialogBody key={table.id} table={table} outletId={outletId} qrOrderingEnabled={qrOrderingEnabled} onClose={onClose} /> : null;
}

function DialogBody({
  table,
  outletId,
  qrOrderingEnabled,
  onClose,
}: Readonly<{ table: DiningTableView; outletId: string; qrOrderingEnabled: boolean | null; onClose: () => void }>) {
  const url = guestOrderUrl(window.location.origin, outletId, table.id);
  const qrDataUrl = useQrDataUrl(url);
  const [copied, setCopied] = useState(false);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="table-qr-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title data-testid="table-qr-dialog-label" className="font-headline text-lg font-semibold">
              {table.label}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              data-testid="table-qr-dialog-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </Dialog.Close>
          </div>

          {qrOrderingEnabled === false && (
            <p data-testid="table-qr-dialog-capability-note" className="mt-3 rounded-md bg-status-error/10 px-3 py-2 text-xs text-status-error">
              Self-ordering is off for this outlet — enable it in Settings
            </p>
          )}

          <div className="mt-4 flex justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not something next/image's optimizer can (or needs to) handle
              <img
                data-testid="table-qr-dialog-image"
                src={qrDataUrl}
                alt={`Self-order QR code for ${table.label}`}
                width={QR_SIZE_PX}
                height={QR_SIZE_PX}
                className="rounded-md border border-border/40"
              />
            ) : (
              <div style={{ width: QR_SIZE_PX, height: QR_SIZE_PX }} className="flex items-center justify-center text-xs text-muted-foreground">
                Generating…
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <code data-testid="table-qr-dialog-url" className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
              {url}
            </code>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Copy guest URL"
              data-testid="table-qr-dialog-copy"
              onClick={() => {
                void navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            data-testid="table-qr-dialog-open"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
