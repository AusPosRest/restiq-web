"use client";

// CAP-8's manager-authorisation gate: the same shape gates all six
// manager-authorised actions (void, comp, discount-above-threshold, price
// override, refund, no-sale drawer open). Each caller passes its own
// `onApprove` - this component only collects a PIN + reason code and
// reports what the caller's handler resolves to; it has no opinion on what
// endpoint that handler calls. Hand-rolled Radix `Dialog` + plain elements,
// matching the rest of this codebase's dialogs (see e.g.
// src/app/admin/(shell)/staff/add-staff-dialog.tsx) rather than a shadcn
// wrapper component - this repo has never added one.
//
// Backend wire-up (restiq-backend#47, "Manager authorisation gate (CAP-8)",
// no branch/PR yet as of this component landing): CAP-8's success
// criterion requires the audit_events row to be written in the *same
// transaction* as the gated action, so there is no standalone "authorise"
// endpoint to call here - each gated action's own endpoint (e.g. POST
// /pos/orders/:id/void) should accept `{ managerPin, reasonCode, ... }`
// alongside its normal payload and do PIN-verify + action + audit insert
// atomically. A caller's `onApprove` should be a thin wrapper wired to its
// own action endpoint, e.g.:
//
//   onApprove={(pin, reasonCode) =>
//     voidOrderLine(orderId, lineId, { managerPin: pin, reasonCode }).then(
//       () => ({ ok: true }),
//       (err) => ({ ok: false, error: err.message }),
//     )
//   }
//
// Once #47 lands, confirm the actual error shape it returns (message
// string vs. structured code) and adjust the `catch` branch below if it
// differs from a plain `Error`.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const PIN_LENGTH = 4;
const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

const SELECT_CLASSES =
  "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface ManagerPinDialogReasonCode {
  value: string;
  label: string;
}

export type ManagerApprovalResult = { ok: true } | { ok: false; error: string };

export interface ManagerPinDialogProps {
  /** Whether the dialog is open. Controlled by the caller. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The specific action being gated, e.g. "Void item", "Refund", "No-sale
   * drawer open". Rendered as "Manager approval — {actionTitle}" - never a
   * bare "Confirm?" (EXPERIENCE.md's Component Patterns).
   */
  actionTitle: string;
  /** Called with the entered PIN and reason code once both are filled and Approve is pressed. */
  onApprove: (pin: string, reasonCode: string) => Promise<ManagerApprovalResult>;
  /** Reason codes offered for this action. Defaults to a generic set if omitted. */
  reasonCodeOptions?: ManagerPinDialogReasonCode[];
}

export const DEFAULT_MANAGER_REASON_CODES: ManagerPinDialogReasonCode[] = [
  { value: "customer-request", label: "Customer request" },
  { value: "order-error", label: "Order entry error" },
  { value: "service-recovery", label: "Service recovery" },
  { value: "manager-discretion", label: "Manager discretion" },
  { value: "other", label: "Other" },
];

export function ManagerPinDialog(props: Readonly<ManagerPinDialogProps>) {
  // Remount the body per open so a prior attempt's PIN/reason/error never
  // leaks into the next one - this instance is reused across many gated
  // actions (same pattern as this repo's other dialogs, e.g. add-staff).
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({
  onOpenChange,
  actionTitle,
  onApprove,
  reasonCodeOptions = DEFAULT_MANAGER_REASON_CODES,
}: Readonly<Omit<ManagerPinDialogProps, "open">>) {
  const [pin, setPin] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canApprove = pin.length === PIN_LENGTH && reasonCode !== "" && !submitting;

  function appendDigit(digit: string) {
    if (submitting) return;
    setError(null);
    setPin((prev) => (prev.length >= PIN_LENGTH ? prev : prev + digit));
  }

  function backspace() {
    if (submitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  function clearPin() {
    if (submitting) return;
    setError(null);
    setPin("");
  }

  async function handleApprove() {
    if (!canApprove) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onApprove(pin, reasonCode);
      if (result.ok) {
        onOpenChange(false);
      } else {
        setError(result.error);
        setPin("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed. Try again.");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }

  // Physical-keyboard support for the PIN pad, per the POS UX spec's
  // Accessibility Floor: touch is the target device, but keyboard entry
  // must keep working for testing/demo.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "SELECT") return;

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backspace();
    } else if (event.key === "Enter" && canApprove) {
      event.preventDefault();
      void handleApprove();
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !submitting && onOpenChange(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="manager-pin-dialog"
          onKeyDown={handleKeyDown}
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title data-testid="manager-pin-dialog-title" className="text-lg font-semibold">
            Manager approval — {actionTitle}
          </Dialog.Title>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3">
              <div data-testid="manager-pin-dialog-pin-display" className="flex gap-3" aria-hidden="true">
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <span
                    key={index}
                    data-testid={`manager-pin-dialog-pin-dot-${index}`}
                    data-filled={index < pin.length}
                    className={`size-4 rounded-full border-2 border-input ${
                      index < pin.length ? "border-primary bg-primary" : ""
                    }`}
                  />
                ))}
              </div>
              <span className="sr-only" aria-live="polite">
                {pin.length} of {PIN_LENGTH} PIN digits entered
              </span>

              <div className="grid w-full max-w-56 grid-cols-3 gap-2">
                {KEYPAD_DIGITS.map((digit) => (
                  <Button
                    key={digit}
                    type="button"
                    variant="outline"
                    size="lg"
                    data-testid={`manager-pin-dialog-digit-${digit}`}
                    disabled={submitting}
                    onClick={() => appendDigit(digit)}
                    className={digit === "0" ? "col-start-2" : undefined}
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  data-testid="manager-pin-dialog-clear"
                  disabled={submitting}
                  onClick={clearPin}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  data-testid="manager-pin-dialog-backspace"
                  disabled={submitting}
                  onClick={backspace}
                  aria-label="Backspace"
                >
                  ⌫
                </Button>
              </div>
            </div>

            <div>
              <label
                htmlFor="manager-pin-dialog-reason"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Reason
              </label>
              <select
                id="manager-pin-dialog-reason"
                data-testid="manager-pin-dialog-reason-select"
                required
                disabled={submitting}
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                className={SELECT_CLASSES}
              >
                <option value="" disabled hidden>
                  Select a reason…
                </option>
                {reasonCodeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p data-testid="manager-pin-dialog-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="manager-pin-dialog-cancel"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="manager-pin-dialog-confirm"
              disabled={!canApprove}
              onClick={() => void handleApprove()}
            >
              {submitting ? "Approving…" : "Approve"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
