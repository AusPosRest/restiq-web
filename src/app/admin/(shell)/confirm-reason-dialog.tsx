"use client";

// The confirm-modal-with-required-reason (EXPERIENCE.md: destructive/security-
// relevant actions are pessimistic with a confirm step; SPEC: price changes,
// role changes and PIN revokes are audited with a reason). Mirrors /ops's
// confirm-reason-dialog.tsx, restyled to the admin realm and its warmer voice.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface ConfirmReasonDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  verb: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function ConfirmReasonDialog(props: Readonly<ConfirmReasonDialogProps>) {
  // Remount the body per open so the reason never leaks between confirmations.
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ title, description, verb, busy, onCancel, onConfirm }: Readonly<ConfirmReasonDialogProps>) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="confirm-reason-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (trimmed && !busy) onConfirm(trimmed);
            }}
          >
            <label htmlFor="confirm-reason" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why is this changing? (kept in the audit trail)
            </label>
            <textarea
              id="confirm-reason"
              data-testid="confirm-reason"
              value={reason}
              rows={2}
              maxLength={500}
              autoFocus
              placeholder="e.g. Supplier cost increase"
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="confirm-cancel" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" data-testid="confirm-submit" disabled={!trimmed || busy}>
                {busy ? "Saving..." : verb}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
