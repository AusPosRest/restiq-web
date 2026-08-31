"use client";

// P11's "log a cash movement" action: paid-out or bank-drop, each with a
// mandatory reason (SPEC CAP-10 constraint). Not one of CAP-8's six manager-
// gated actions, so no manager PIN here - just the reason requirement, same
// pessimistic-dialog shape as /admin's ConfirmReasonDialog but pos can't
// import it (AD-4 realm isolation), and this dialog also needs an amount
// field ConfirmReasonDialog doesn't have.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "./amount-keypad";
import type { CashMovementType } from "../../api";
import { appendDigit, digitsToMinor, validateMovementForm } from "./shift-state";

export interface LogMovementDialogProps {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (type: CashMovementType, amountMinor: number, reason: string) => void;
}

export function LogMovementDialog(props: Readonly<LogMovementDialogProps>) {
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ busy, error, onCancel, onSubmit }: Readonly<LogMovementDialogProps>) {
  const [type, setType] = useState<CashMovementType>("paid_out");
  const [digits, setDigits] = useState("");
  const [reason, setReason] = useState("");
  const errors = validateMovementForm(digits, reason);
  const canSubmit = Object.keys(errors).length === 0 && !busy;

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="log-movement-dialog"
          className="pos-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Log a cash movement</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Record cash leaving the drawer for a paid-out or a bank drop.
          </Dialog.Description>

          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onSubmit(type, digitsToMinor(digits), reason.trim());
            }}
          >
            <fieldset className="flex justify-center gap-4 text-sm" data-testid="movement-type">
              {(["paid_out", "bank_drop"] as CashMovementType[]).map((option) => (
                <label key={option} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="movement-type"
                    value={option}
                    checked={type === option}
                    onChange={() => setType(option)}
                    className="accent-primary"
                  />
                  {option === "paid_out" ? "Paid out" : "Bank drop"}
                </label>
              ))}
            </fieldset>

            <div className="flex justify-center">
              <AmountKeypad
                testId="movement-amount-keypad"
                digits={digits}
                disabled={busy}
                onDigit={(digit) => setDigits((current) => appendDigit(current, digit))}
                onBackspace={() => setDigits((current) => current.slice(0, -1))}
                onClear={() => setDigits("")}
              />
            </div>
            {errors.amount && (
              <p data-testid="movement-amount-error" className="text-center text-xs text-status-alert">
                {errors.amount}
              </p>
            )}

            <div>
              <label htmlFor="movement-reason" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reason
              </label>
              <textarea
                id="movement-reason"
                data-testid="movement-reason"
                value={reason}
                rows={2}
                maxLength={500}
                placeholder="e.g. Change for the bank"
                onChange={(event) => setReason(event.target.value)}
                className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.reason && (
                <p data-testid="movement-reason-error" className="mt-1 text-xs text-status-alert">
                  {errors.reason}
                </p>
              )}
            </div>

            {error && (
              <p role="alert" data-testid="movement-submit-error" className="text-sm text-status-alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="movement-cancel" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" data-testid="movement-submit" disabled={!canSubmit}>
                {busy ? "Saving..." : "Log movement"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
