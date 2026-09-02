"use client";

// The task's discount action: "below-threshold: plain reason field;
// above-threshold: routes through the reused ManagerPinDialog." Percent-only
// entry (matches the P8 mock's own "Discount 10%" line) via AmountKeypad
// (percent display via its additive `display` prop), per EXPERIENCE.md's
// numeric-entry rule - the real, already-merged ManagerPinDialog
// (src/app/pos/components/manager-pin-dialog.tsx, story 9/#42) still gates
// the above-threshold path, not a second PIN dialog.
//
// RECONCILED (2026-09-02, restiq-web#98): the real `FinalizeBillDto`
// (bills.dtos.ts, read directly) takes a flat `discountMinor` amount, not a
// percent - this dialog still collects a percent (the nicer entry UX) but
// converts it to `discountMinor = round(subtotalMinor * percent / 100)`
// before handing it to the caller. The manager-approval threshold is 20% of
// the bill's *subtotal* (`bills.service.ts`'s `DISCOUNT_THRESHOLD_PERCENT`),
// checked on that converted amount, not the old flat 10%-of-percent guess.
//
// There is also no standalone "verify this PIN" endpoint - the real
// discount-above-threshold check only happens inside the one finalize call
// (manager-pin-dialog.tsx's own header already documents this: "no
// standalone authorise endpoint ... do PIN-verify + action + audit insert
// atomically"). So unlike CAP-9's refund dialog, `onApply` here never talks
// to the network - it just hands the caller a `PendingDiscount` to hold
// until Finalize; a wrong PIN or a threshold mismatch surfaces later, as a
// real finalize error, not from this dialog.
import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { ManagerPinDialog, type ManagerPinDialogReasonCode } from "../../../components/manager-pin-dialog";
import { AmountKeypad } from "../../../(shell)/shift/amount-keypad";
import { appendDigit, digitsToMinor } from "../../../(shell)/shift/shift-state";
import { discountRequiresManagerApproval, type PendingDiscount } from "./bill-state";

const DISCOUNT_REASON_OPTIONS: ManagerPinDialogReasonCode[] = [
  { value: "regular-guest", label: "Regular guest" },
  { value: "service-recovery", label: "Service recovery" },
  { value: "manager-discretion", label: "Manager discretion" },
  { value: "other", label: "Other" },
];

export interface DiscountDialogProps {
  open: boolean;
  subtotalMinor: number;
  onCancel: () => void;
  onApply: (discount: PendingDiscount) => void;
}

export function DiscountDialog(props: Readonly<DiscountDialogProps>) {
  return props.open ? <DiscountDialogBody key="open" {...props} /> : null;
}

function DiscountDialogBody({ subtotalMinor, onCancel, onApply }: Readonly<Omit<DiscountDialogProps, "open">>) {
  const [digits, setDigits] = useState("");
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<"form" | "manager-approval">("form");

  const percent = digitsToMinor(digits);
  const discountMinor = Math.round((subtotalMinor * percent) / 100);
  const requiresApproval = percent > 0 && discountRequiresManagerApproval(discountMinor, subtotalMinor);
  const canApply = percent > 0 && !requiresApproval && reason.trim() !== "";

  function submitBelowThreshold() {
    if (!canApply) return;
    onApply({ amountMinor: discountMinor, reason: reason.trim() });
    onCancel();
  }

  if (stage === "manager-approval") {
    return (
      <ManagerPinDialog
        open
        // ManagerPinDialog closes itself (calls this with `false`) both when
        // the manager cancels and once onApprove resolves `ok: true` - either
        // way there is nothing left for this wrapper to do but close too.
        onOpenChange={(next) => {
          if (!next) onCancel();
        }}
        actionTitle="Discount above threshold"
        reasonCodeOptions={DISCOUNT_REASON_OPTIONS}
        onApprove={(pin, reasonCode) => {
          const label = DISCOUNT_REASON_OPTIONS.find((option) => option.value === reasonCode)?.label ?? reasonCode;
          onApply({ amountMinor: discountMinor, reason: label, managerPin: pin });
          return Promise.resolve({ ok: true as const });
        }}
      />
    );
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="discount-dialog"
          className="pos-theme fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Add discount</Dialog.Title>

          <div className="mt-4 flex justify-center">
            <AmountKeypad
              testId="discount-amount"
              digits={digits}
              display={`${percent}%`}
              onDigit={(digit) => setDigits((current) => appendDigit(current, digit, 2))}
              onBackspace={() => setDigits((current) => current.slice(0, -1))}
              onClear={() => setDigits("")}
            />
          </div>

          {requiresApproval && (
            <p data-testid="discount-requires-approval" className="mt-3 text-center text-sm text-status-warning">
              {percent}% is at or above the manager-approval threshold — a manager PIN and reason will be required.
            </p>
          )}

          {!requiresApproval && (
            <div className="mt-4">
              <label htmlFor="discount-reason" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reason
              </label>
              <input
                id="discount-reason"
                type="text"
                data-testid="discount-reason"
                value={reason}
                maxLength={200}
                placeholder="e.g. Regular guest"
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" data-testid="discount-cancel" onClick={onCancel}>
              Cancel
            </Button>
            {requiresApproval ? (
              <Button type="button" data-testid="discount-continue-to-approval" disabled={percent <= 0} onClick={() => setStage("manager-approval")}>
                Continue to manager approval
              </Button>
            ) : (
              <Button type="button" data-testid="discount-apply" disabled={!canApply} onClick={submitBelowThreshold}>
                Apply discount
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
