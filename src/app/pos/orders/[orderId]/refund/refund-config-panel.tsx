"use client";

// The P10 mock's right-hand "Refund Configuration" panel: pick items/qty to
// refund from the finalised bill, a mandatory reason (via the reused
// ManagerPinDialog - see refund-state.ts's file header for why there is no
// plain-reason path here, unlike CAP-7's discount), and optional manager
// notes. "Process refund" only opens the gate - createRefund() is only ever
// called from ManagerPinDialog's onApprove, so there is no code path that
// issues a refund without a valid PIN + reason.
//
// RECONCILED (2026-09-02, restiq-web#98): the real `RefundBillDto`
// (bills.dtos.ts, read directly) has no `refundMethod` field at all - a
// refund only ever produces a credit note, it doesn't choose how the money
// physically moves - so the old "Issue refund to Cash/UPI" picker is
// dropped. It also has a single required `reason: string`, not a
// `reasonCode` + separate `notes` pair - composed here from the reused
// ManagerPinDialog's picked reason label plus any free-text notes. The call
// itself now targets `billId` (the real endpoint is `POST
// bills/:id/refund`), not `orderId`.
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRefund, PosApiError } from "../../../api";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import { ManagerPinDialog, type ManagerApprovalResult, type ManagerPinDialogReasonCode } from "../../../components/manager-pin-dialog";
import type { OrderLineView } from "../order-taking-state";
import {
  computeRefundTotals,
  hasRefundSelection,
  setLineQuantity,
  toRefundLineInputs,
  toggleLineSelected,
  type CreditNoteView,
  type RefundSelection,
} from "./refund-state";

const REFUND_REASON_OPTIONS: ManagerPinDialogReasonCode[] = [
  { value: "customer-complaint", label: "Customer complaint" },
  { value: "order-error", label: "Order entry error" },
  { value: "quality-issue", label: "Quality issue" },
  { value: "duplicate-charge", label: "Duplicate charge" },
  { value: "other", label: "Other" },
];

export interface RefundConfigPanelProps {
  billId: string;
  lines: OrderLineView[];
  currency: string;
  onRefunded: (creditNote: CreditNoteView) => void;
}

export function RefundConfigPanel({ billId, lines, currency, onRefunded }: Readonly<RefundConfigPanelProps>) {
  const [selection, setSelection] = useState<RefundSelection>({});
  const [notes, setNotes] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const totals = computeRefundTotals(lines, selection);
  const canSubmit = hasRefundSelection(selection);

  async function handleApprove(pin: string, reasonCode: string): Promise<ManagerApprovalResult> {
    const label = REFUND_REASON_OPTIONS.find((option) => option.value === reasonCode)?.label ?? reasonCode;
    const reason = notes.trim() ? `${label}: ${notes.trim()}` : label;
    try {
      const creditNote = await createRefund(billId, {
        lines: toRefundLineInputs(selection),
        reason,
        managerPin: pin,
      });
      onRefunded(creditNote);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof PosApiError ? error.message : "Couldn't process the refund." };
    }
  }

  return (
    <section data-testid="refund-config-panel" className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="font-headline text-lg font-semibold text-foreground">Refund configuration</h2>
        <p className="text-sm text-muted-foreground">Select items from the left to build the refund.</p>
      </div>

      <ul data-testid="refund-line-list" className="flex flex-col gap-2">
        {lines.map((line) => {
          const selectedQty = selection[line.id] ?? 0;
          const selected = selectedQty > 0;
          return (
            <li key={line.id} data-testid={`refund-line-${line.id}`} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <input
                type="checkbox"
                data-testid={`refund-line-select-${line.id}`}
                aria-label={`Select ${line.itemName} for refund`}
                checked={selected}
                onChange={(event) => setSelection((current) => toggleLineSelected(current, line, event.target.checked))}
                className="size-4"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{line.itemName}</p>
                <p className="text-xs text-muted-foreground">{formatMinor(line.unitPriceMinor, currency)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid={`refund-line-decrement-${line.id}`}
                  aria-label={`Decrease refund quantity for ${line.itemName}`}
                  disabled={!selected || selectedQty <= 1}
                  onClick={() => setSelection((current) => setLineQuantity(current, line, selectedQty - 1))}
                  className="flex size-7 items-center justify-center rounded-md border border-border disabled:pointer-events-none disabled:opacity-40"
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </button>
                <span data-testid={`refund-line-qty-${line.id}`} className="w-6 text-center text-sm font-semibold tabular-nums">
                  {selected ? selectedQty : line.quantity}
                </span>
                <button
                  type="button"
                  data-testid={`refund-line-increment-${line.id}`}
                  aria-label={`Increase refund quantity for ${line.itemName}`}
                  disabled={!selected || selectedQty >= line.quantity}
                  onClick={() => setSelection((current) => setLineQuantity(current, line, selectedQty + 1))}
                  className="flex size-7 items-center justify-center rounded-md border border-border disabled:pointer-events-none disabled:opacity-40"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <dl data-testid="refund-totals" className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-4 text-sm">
        <Row label="Refund subtotal" value={formatMinor(totals.subtotalMinor, currency)} />
        <Row label="Tax reversal" value={formatMinor(totals.taxReversalMinor, currency)} />
        <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
          <dt className="font-label text-sm font-semibold uppercase tracking-wider text-foreground">Total refund value</dt>
          <dd data-testid="refund-total-value" className="tabular-nums text-lg font-bold text-primary">
            {formatMinor(totals.totalMinor, currency)}
          </dd>
        </div>
      </dl>

      <div>
        <label htmlFor="refund-notes" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Manager notes
        </label>
        <textarea
          id="refund-notes"
          data-testid="refund-notes"
          rows={3}
          value={notes}
          maxLength={500}
          placeholder="Add specific details regarding the refund"
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="mt-auto flex justify-end gap-2 border-t border-border/60 pt-4">
        <Button
          size="lg"
          variant="destructive"
          data-testid="process-refund"
          disabled={!canSubmit}
          onClick={() => setPinDialogOpen(true)}
        >
          Process refund
        </Button>
      </div>

      <ManagerPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        actionTitle="Refund"
        reasonCodeOptions={REFUND_REASON_OPTIONS}
        onApprove={handleApprove}
      />
    </section>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
