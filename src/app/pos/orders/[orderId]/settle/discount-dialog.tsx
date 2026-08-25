"use client";

// The task's discount action: "below-threshold: plain reason field;
// above-threshold: routes through the reused ManagerPinDialog." Percent-only
// (matches the P8 mock's own "Discount 10%" line exactly - a fixed-amount
// discount isn't shown anywhere in the mock or asked for in the task, so it
// isn't built here, YAGNI). Reuses AmountKeypad (percent display via its
// additive `display` prop) for entry, per EXPERIENCE.md's numeric-entry rule,
// and the real, already-merged ManagerPinDialog
// (src/app/pos/components/manager-pin-dialog.tsx, story 9/#42) for the
// above-threshold path - not a second PIN dialog.
//
// Below threshold, this dialog collects its own plain-text reason and calls
// `onApply` directly. At/above threshold, the plain reason field is replaced
// by ManagerPinDialog's own required reason-code select (its `onApprove`
// return shape doubles as `onApply`'s), so the same `onApply` prop drives
// both paths - see bill-settle-view.tsx for the one applyBillDiscount() call
// both eventually reach.
import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { ManagerPinDialog, type ManagerApprovalResult, type ManagerPinDialogReasonCode } from "../../../components/manager-pin-dialog";
import { AmountKeypad } from "../../../(shell)/shift/amount-keypad";
import { appendDigit, digitsToMinor } from "../../../(shell)/shift/shift-state";
import { discountRequiresManagerApproval, type ApplyDiscountInput } from "./bill-state";

const DISCOUNT_REASON_OPTIONS: ManagerPinDialogReasonCode[] = [
  { value: "regular-guest", label: "Regular guest" },
  { value: "service-recovery", label: "Service recovery" },
  { value: "manager-discretion", label: "Manager discretion" },
  { value: "other", label: "Other" },
];

export interface DiscountDialogProps {
  open: boolean;
  onCancel: () => void;
  onApply: (input: ApplyDiscountInput) => Promise<ManagerApprovalResult>;
}

export function DiscountDialog(props: Readonly<DiscountDialogProps>) {
  return props.open ? <DiscountDialogBody key="open" {...props} /> : null;
}

function DiscountDialogBody({ onCancel, onApply }: Readonly<Omit<DiscountDialogProps, "open">>) {
  const [digits, setDigits] = useState("");
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<"form" | "manager-approval">("form");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const percent = digitsToMinor(digits);
  const requiresApproval = percent > 0 && discountRequiresManagerApproval(percent);
  const canApply = percent > 0 && !requiresApproval && reason.trim() !== "" && !submitting;

  async function submitBelowThreshold() {
    if (!canApply) return;
    setSubmitting(true);
    setFormError(null);
    const result = await onApply({ percentValue: percent, reasonCode: reason.trim() });
    setSubmitting(false);
    // A rejected/thrown apply surfaces inline without closing (same pattern
    // as ManagerPinDialog's own onApprove handling); success closes the
    // whole flow - bill-settle-view has already applied the new BillView by
    // the time this resolves.
    if (result.ok) onCancel();
    else setFormError(result.error);
  }

  if (stage === "manager-approval") {
    return (
      <ManagerPinDialog
        open
        // ManagerPinDialog closes itself (calls this with `false`) both when
        // the manager cancels and when onApprove resolves `ok: true` - either
        // way there is nothing left for this wrapper to do but close too.
        onOpenChange={(next) => {
          if (!next) onCancel();
        }}
        actionTitle="Discount above threshold"
        reasonCodeOptions={DISCOUNT_REASON_OPTIONS}
        onApprove={(pin, reasonCode) => onApply({ percentValue: percent, reasonCode, managerPin: pin })}
      />
    );
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !submitting && onCancel()}>
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
              disabled={submitting}
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
                disabled={submitting}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {formError && (
            <p role="alert" data-testid="discount-error" className="mt-3 text-sm text-status-alert">
              {formError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" data-testid="discount-cancel" disabled={submitting} onClick={onCancel}>
              Cancel
            </Button>
            {requiresApproval ? (
              <Button type="button" data-testid="discount-continue-to-approval" disabled={percent <= 0} onClick={() => setStage("manager-approval")}>
                Continue to manager approval
              </Button>
            ) : (
              <Button type="button" data-testid="discount-apply" disabled={!canApply} onClick={() => void submitBelowThreshold()}>
                {submitting ? "Applying…" : "Apply discount"}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
