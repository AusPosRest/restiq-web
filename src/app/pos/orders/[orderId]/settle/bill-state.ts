// pos/CAP-7 bill & settle. RECONCILED (2026-09-02, restiq-web#98) against the
// real, merged restiq-backend contract (src/pos/bills/{bills.controller.ts,
// bills.service.ts,bills.dtos.ts,bill-core.ts}, read directly). What the
// original self-authored guess (restiq-backend#59 had no branch at the time)
// got wrong, all fixed here:
//  - only four endpoints exist: `POST orders/:orderId/bill` (create),
//    `GET bills/:id`, `POST bills/:id/finalize`, `POST bills/:id/refund` -
//    there is no per-order GET and no separate discount/tender endpoints.
//    Discount and every tender are submitted together in the one finalize
//    call (`FinalizeBillDto`) - this screen now accumulates them locally
//    (`PendingTender`/`PendingDiscount` below) instead of round-tripping a
//    server call per tap; `../../../api.ts`'s `fetchOrCreateBill`/
//    `finalizeBill` cover the actual calls.
//  - `BillView` carries one flat `taxMinor` (bill-core.ts's
//    `TAX_RATE_PLACEHOLDER_PERCENT`, 5% of subtotal - no per-item/per-rate
//    breakdown, no CGST/SGST split, no round-off line - none of those exist
//    anywhere in the schema). `discountMinor` is a flat minor amount plus a
//    free-text `discountReason`, not a percent value + reason code.
//  - the manager-approval threshold is 20% of the bill's subtotal
//    (`bills.service.ts`'s `DISCOUNT_THRESHOLD_PERCENT`), not the old 10%
//    guess, and it gates the discount *amount*, not a client-typed percent.
//  - `status` is `"open"`/`"finalized"` (`BillStatus`,
//    prisma/schema.prisma), not the old `"draft"`/`"finalised"`.
//  - a Bill carries no order lines, table label, or currency of its own -
//    those are the Order/Menu's job (`order-taking-state.ts`), read
//    separately by the settle screen alongside the Bill.

export type BillStatus = "open" | "finalized";
export type BillTenderMethod = "cash" | "upi_manual";

export const TENDER_METHOD_LABEL: Record<BillTenderMethod, string> = {
  cash: "Cash",
  upi_manual: "UPI",
};

/** The real, verified wire shape of one entry in `BillView.tenders` (bills.dtos.ts's `TenderView`, read directly). */
export interface BillTenderView {
  id: string;
  method: BillTenderMethod;
  amountMinor: number;
  createdAt: string;
}

/** The real, verified wire shape `POST orders/:orderId/bill`, `GET bills/:id`, and `POST bills/:id/finalize` all return (bills.dtos.ts's `BillView`, read directly). */
export interface BillView {
  id: string;
  orderId: string;
  billNumber: number | null;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number | null;
  discountReason: string | null;
  /** subtotal + tax - discount, never persisted as its own column - always derived server-side (bill-core.ts's `toBillView`). */
  totalMinor: number;
  status: BillStatus;
  createdAt: string;
  finalizedAt: string | null;
  tenders: BillTenderView[];
}

/**
 * Not yet submitted - the real backend never sees a tender on its own; every
 * one rides inside the single finalize call (`FinalizeBillDto.tenders`), so
 * this screen holds them here (an in-memory, removable list) until Finalize
 * actually posts them.
 */
export interface PendingTender {
  method: BillTenderMethod;
  amountMinor: number;
}

/** Not yet submitted either - same finalize-call-only posture as `PendingTender` (`FinalizeBillDto.discountMinor`/`discountReason`). `managerPin` is only ever present on the above-threshold path (see discount-dialog.tsx). */
export interface PendingDiscount {
  amountMinor: number;
  reason: string;
  managerPin?: string;
}

/** The real `POST bills/:id/finalize` request body (`FinalizeBillDto`, read directly). */
export interface FinalizeBillInput {
  discountMinor?: number;
  discountReason?: string;
  /** Only required when `discountMinor` clears the manager-approval threshold below. */
  managerPin?: string;
  tenders: PendingTender[];
}

/** `bills.service.ts`'s `DISCOUNT_THRESHOLD_PERCENT` - a discount above this fraction of the subtotal requires a manager PIN, verified server-side inside the finalize transaction (there is no separate "verify PIN" endpoint to call ahead of it). */
export const DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT = 20;

export function discountRequiresManagerApproval(discountMinor: number, subtotalMinor: number): boolean {
  return discountMinor * 100 > subtotalMinor * DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT;
}

export function pendingTenderedMinor(tenders: readonly PendingTender[]): number {
  return tenders.reduce((sum, tender) => sum + tender.amountMinor, 0);
}

/** subtotal + tax - discount, mirroring bill-core.ts's `toBillView`/`commitFinalize` math exactly. `pendingDiscountMinor` lets the settle screen preview the total for a discount that hasn't been submitted yet (an already-finalized bill's own `discountMinor` always wins once it's non-null). */
export function billTotalMinor(bill: Pick<BillView, "subtotalMinor" | "taxMinor" | "discountMinor">, pendingDiscountMinor = 0): number {
  const discountMinor = bill.discountMinor ?? pendingDiscountMinor;
  return bill.subtotalMinor + bill.taxMinor - discountMinor;
}

/** Finalize is disabled until the pending tenders exactly cover the total - `bill-core.ts`'s `commitFinalize` rejects any other sum with a 400 `tender_mismatch`, this mirrors that gate client-side, same posture as `order-taking-state.ts`'s `canSendToKitchen`. */
export function canFinalizeBill(bill: Pick<BillView, "status">, totalMinor: number, tenders: readonly PendingTender[]): boolean {
  return bill.status === "open" && tenders.length > 0 && pendingTenderedMinor(tenders) === totalMinor;
}

/** Once a bill is finalized, AD-14 forbids every mutation this screen offers (discount, tenders) - callers gate all mutation UI on this, not just the Finalize button. */
export function isBillReadOnly(bill: Pick<BillView, "status">): boolean {
  return bill.status === "finalized";
}
