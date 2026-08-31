"use client";

// Accounting export destination picker (EXPERIENCE.md T9 pattern: a simple
// picker over Tally/Xero/MYOB/Zoho/QuickBooks). Every destination honestly
// shows "not_connected" - no fake connected state, no OAuth flow that
// doesn't exist (issue #42's acceptance bar). Backed by a real (if trivial)
// GET /admin/v1/reports/export-destinations - see reports-state.ts's file
// header. Remounts the body per open (mirrors ConfirmReasonDialog/
// GenerateCodeDialog) so useAdminLoad's GET only fires while the dialog is
// actually shown.
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useAdminLoad } from "../use-admin-load";
import type { ExportDestinationView } from "./reports-state";

export function ExportDestinationsDialog(props: Readonly<{ open: boolean; onClose: () => void }>) {
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="export-destinations-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-headline text-lg font-semibold">Accounting tools</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              data-testid="export-destinations-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Send summarised journals straight to your accounting tool once it&apos;s connected.
          </Dialog.Description>

          <div className="mt-4">
            <DestinationsList />
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="secondary" size="sm" data-testid="export-destinations-done" onClick={onClose}>
              Done
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DestinationsList() {
  const { loading, failed, data, retry } = useAdminLoad<ExportDestinationView[]>("reports/export-destinations");

  if (loading) return <Skeleton data-testid="export-destinations-loading" className="h-32" />;
  if (failed) return <LoadErrorPanel testId="export-destinations-load-error" message="Accounting tools couldn't be loaded." onRetry={retry} />;
  if (!data) return null;

  return (
    <ul className="flex flex-col gap-2">
      {data.map((destination) => (
        <li
          key={destination.key}
          data-testid={`export-destination-${destination.key}`}
          className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3"
        >
          <span className="text-sm font-medium">{destination.name}</span>
          <span data-testid={`export-destination-${destination.key}-status`} className="text-xs text-muted-foreground">
            Not connected
          </span>
        </li>
      ))}
    </ul>
  );
}
