// Pure logic & types for P10 Refund & Adjustments (CAP-9, story 10). Kept
// framework-free per this codebase's *-state.ts convention (bill-state.ts,
// order-taking-state.ts, shift-state.ts) so refund-total math is
// unit-testable without a DOM.
//
// RECONCILED (2026-09-02, restiq-web#98) against the real, merged
// restiq-backend contract (src/pos/bills/{bills.controller.ts,
// bills.service.ts,bills.dtos.ts}, read directly). What the original
// self-authored guess (restiq-backend#63 had no branch at the time) got
// wrong, all fixed here:
//  - the real endpoint is `POST bills/:id/refund` (targets the Bill, not the
//    Order - `../../../api.ts`'s `createRefund` now takes a `billId`), and
//    its body is `RefundBillDto`: `managerPin`, a single free-text `reason`
//    string, and an optional `lines: {orderLineId, quantity}[]` - omitted
//    entirely to mean "refund everything not already refunded". There is no
//    `refundMethod` anywhere in that DTO - a refund only ever produces a
//    credit note, it doesn't choose how the money physically moves, so the
//    old "Issue refund to Cash/UPI" picker has no backing field at all and
//    is dropped.
//  - tax reversal is bill-core.ts's own flat `TAX_RATE_PLACEHOLDER_PERCENT`
//    (5%) applied to the refunded subtotal (`bills.service.ts`'s `refund()`,
//    read directly) - not a "combined CGST+SGST" figure read off two tax
//    lines that don't exist on the real `BillView` any more (see
//    `../settle/bill-state.ts`'s file header).
//  - a refunded line's per-unit amount is unit price *plus its selected
//    modifiers* (`bills.service.ts`'s `refund()` folds `line.modifiers` in
//    exactly like `bill-core.ts`'s `computeSubtotal()` does going forward) -
//    reuses `order-taking-state.ts`'s own `computeUnitTotalMinor` for that,
//    rather than re-deriving it.
//  - the resulting `CreditNoteView` carries no `creditNoteNumber`/
//    `billNumber` (no numbering scheme exists for credit notes) and no
//    `currency` of its own - same "no currency on the money record itself"
//    posture as `BillView`.
//
// Client-side quantity clamping below only guards against over-refunding
// *this* selection past a line's original quantity - it doesn't know about
// any earlier partial refund's already-consumed units (there is no read
// endpoint for a bill's existing credit notes to check against). The real
// `bills.service.ts`'s `refund()` is the actual source of truth for that
// (its own `refundedSoFar` bookkeeping) and rejects an over-refund with a
// real 400 `over_refund` - this client-side clamp is UX guidance only, same
// "mirrors, never replaces, the server gate" posture as
// `order-taking-state.ts`'s `canSendToKitchen`.
import { computeUnitTotalMinor, type OrderLineView } from "../order-taking-state";

/** Selected refund quantity per original order line id; a line absent (or 0) isn't part of the refund. */
export type RefundSelection = Record<string, number>;

export function toggleLineSelected(selection: RefundSelection, line: OrderLineView, selected: boolean): RefundSelection {
  const next = { ...selection };
  if (selected) next[line.id] = next[line.id] || line.quantity;
  else delete next[line.id];
  return next;
}

/** Clamped to [1, line.quantity] - a refund can never exceed what was originally billed (see file header for why this doesn't also account for earlier partial refunds). */
export function setLineQuantity(selection: RefundSelection, line: OrderLineView, quantity: number): RefundSelection {
  const clamped = Math.min(Math.max(quantity, 1), line.quantity);
  return { ...selection, [line.id]: clamped };
}

export interface RefundLineTotal {
  line: OrderLineView;
  quantity: number;
  amountMinor: number;
}

export interface RefundTotals {
  lines: RefundLineTotal[];
  subtotalMinor: number;
  taxReversalMinor: number;
  totalMinor: number;
}

/** `bill-core.ts`'s `TAX_RATE_PLACEHOLDER_PERCENT` - the same flat rate `bills.service.ts`'s `refund()` reverses at. */
export const REFUND_TAX_RATE_PERCENT = 5;

export function computeRefundTotals(lines: readonly OrderLineView[], selection: RefundSelection): RefundTotals {
  const linesById = new Map(lines.map((line) => [line.id, line]));
  const selected: RefundLineTotal[] = Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([lineId, selectedQuantity]) => {
      const line = linesById.get(lineId);
      if (!line) return null;
      const quantity = Math.min(selectedQuantity, line.quantity);
      return { line, quantity, amountMinor: computeUnitTotalMinor(line.unitPriceMinor, line.modifiers) * quantity };
    })
    .filter((entry): entry is RefundLineTotal => entry !== null);

  const subtotalMinor = selected.reduce((sum, entry) => sum + entry.amountMinor, 0);
  const taxReversalMinor = Math.round((subtotalMinor * REFUND_TAX_RATE_PERCENT) / 100);
  return { lines: selected, subtotalMinor, taxReversalMinor, totalMinor: subtotalMinor + taxReversalMinor };
}

export function hasRefundSelection(selection: RefundSelection): boolean {
  return Object.values(selection).some((quantity) => quantity > 0);
}

/** The real `RefundBillDto.lines` shape (`RefundLineDto`, read directly). */
export interface RefundLineInput {
  orderLineId: string;
  quantity: number;
}

export function toRefundLineInputs(selection: RefundSelection): RefundLineInput[] {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}

/** The real `POST bills/:id/refund` request body (`RefundBillDto`, read directly) - `reason` is a single required string, composed client-side from the reused `ManagerPinDialog`'s reason-code label plus any free-text notes (see `refund-config-panel.tsx`). */
export interface CreateRefundInput {
  managerPin: string;
  reason: string;
  /** Omitted entirely to mean "refund every line's full remaining quantity" - a whole-bill refund, not a separate code path (matches `RefundBillDto.lines`'s own optionality). */
  lines?: RefundLineInput[];
}

export interface CreditNoteLineView {
  id: string;
  orderLineId: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}

/** AD-14 insert-only: a credit note, never a mutated Bill (SPEC CAP-9's success criterion). The real, verified wire shape `POST bills/:id/refund` returns (bills.dtos.ts's `CreditNoteView`, read directly). */
export interface CreditNoteView {
  id: string;
  originalBillId: string;
  reason: string;
  approvedByStaffId: string;
  createdByStaffId: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  createdAt: string;
  lines: CreditNoteLineView[];
}

/** Only a finalized bill can be refunded - nothing about an in-progress open bill makes sense to refund. Callers gate the whole mutation UI on this. */
export function canRefundBill(bill: { status: string }): boolean {
  return bill.status === "finalized";
}
