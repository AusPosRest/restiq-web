"use client";

// EXPERIENCE.md's Priya flow, made explicit UI: "the app refuses a silent
// edit and surfaces the explicit transfer action naming Priya as the current
// owner... the transfer dialog itself [is] the one moment the app insists on
// explicit human confirmation instead of just letting the tap through."
// Shaped like /admin's confirm-reason-dialog.tsx, but reason is optional here
// (stories.yaml story 3: transfer is audited but isn't one of CAP-8's six
// manager-gated actions, so no PIN and no mandatory reason).
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface TransferOwnershipDialogProps {
  open: boolean;
  tableLabel: string;
  ownerName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function TransferOwnershipDialog(props: Readonly<TransferOwnershipDialogProps>) {
  // Remount per open so a typed reason never leaks between confirmations.
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ tableLabel, ownerName, busy, onCancel, onConfirm }: Readonly<TransferOwnershipDialogProps>) {
  const [reason, setReason] = useState("");

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="transfer-ownership-dialog"
          className="pos-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Transfer ownership — Table {tableLabel}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Currently owned by <span className="font-semibold text-foreground">{ownerName}</span>. Transferring makes you the
            owner - the order history stays one thread under both staff members&apos; names.
          </Dialog.Description>

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) onConfirm(reason.trim());
            }}
          >
            <label htmlFor="transfer-reason" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reason (optional)
            </label>
            <textarea
              id="transfer-reason"
              data-testid="transfer-reason"
              value={reason}
              rows={2}
              maxLength={500}
              autoFocus
              placeholder="e.g. Covering the section while Priya is plating"
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="transfer-cancel" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" data-testid="transfer-confirm" disabled={busy}>
                {busy ? "Transferring..." : "Transfer ownership"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
