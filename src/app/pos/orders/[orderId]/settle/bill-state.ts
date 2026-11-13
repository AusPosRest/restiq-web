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

import type { TaxBreakdownEntry } from "@/lib/tax-lines";

export type BillStatus = "open" | "finalized";

/** The tenant's CGST/SGST odd-paisa rule (restiq-backend#244, restiq-web#369). Null where it doesn't apply (non-IN, IGST, composition) - read as `exact_total`. */
export type GstSplitRounding = "exact_total" | "equal_half_up" | "equal_half_even";

/** The methods a cashier can post in the finalize call (bills.dtos.ts's `TENDER_METHODS`). `external` (issue #224) is money taken outside RESTIQ, with its reference. */
export type PostableTenderMethod = "cash" | "upi_manual" | "external";
/** Every method a bill's tenders can carry (prisma's `TenderMethod`, widened by restiq-backend#130): the four electronic ones are only ever written by the server when a payment intent confirms (ADR-001). */
export type BillTenderMethod = PostableTenderMethod | "upi_intent" | "upi_qr" | "card_online" | "card_terminal";

export const TENDER_METHOD_LABEL: Record<BillTenderMethod, string> = {
  cash: "Cash",
  upi_manual: "UPI",
  upi_intent: "UPI app",
  upi_qr: "UPI QR",
  card_online: "Card (online)",
  card_terminal: "Card terminal",
  external: "External",
};

/** The real, verified wire shape of one entry in `BillView.tenders` (bills.dtos.ts's `TenderView`, read directly; `paymentIntentId`/`riskAcknowledged` per restiq-backend#130). */
export interface BillTenderView {
  id: string;
  method: BillTenderMethod;
  amountMinor: number;
  /** The confirmed intent an electronic tender came from; null for cash / manual UPI. Optional only for older fixtures - the backend always sends it. */
  paymentIntentId?: string | null;
  riskAcknowledged?: boolean;
  /** An external tender's reference / bill number (restiq-backend#146); null otherwise. */
  reference?: string | null;
  createdAt: string;
}

/** The real, verified wire shape `POST orders/:orderId/bill`, `GET bills/:id`, and `POST bills/:id/finalize` all return (bills.dtos.ts's `BillView`, read directly). */
export interface BillView {
  id: string;
  orderId: string;
  billNumber: number | null;
  subtotalMinor: number;
  taxMinor: number;
  /** Per-rate tax lines (CGST/SGST for India, GST for AU), snapshotted when the bill is created (bills.dtos.ts's TaxBreakdownLineView). Optional for older fixtures. */
  taxBreakdown?: TaxBreakdownEntry[];
  discountMinor: number | null;
  discountReason: string | null;
  /** True for tax-inclusive pricing (AU): subtotalMinor already contains taxMinor, so the payable total is subtotal - discount. Optional only for older fixtures; the backend always sends it. */
  pricesIncludeTax?: boolean;
  /** How finalize splits CGST/SGST; null where it doesn't apply. Optional only for older fixtures; the backend always sends it. */
  gstSplitRounding?: GstSplitRounding | null;
  /** subtotal (+ tax when not inclusive) - discount, never persisted as its own column - always derived server-side (bill-core.ts's `toBillView`). */
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
  method: PostableTenderMethod;
  amountMinor: number;
  /** Required for `external`: the outside receipt / bill number. */
  reference?: string;
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

/** round(numerator / denominator), half away from zero - the backend's tax.ts roundHalfUp, integer-only. */
// BigInt(...) rather than 1n literals: the web build targets below ES2020.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const BASIS_POINTS = BigInt(10_000);

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < ZERO) return -roundHalfUp(-numerator, denominator);
  return (numerator * TWO + denominator) / (denominator * TWO);
}

/** round(numerator / denominator), half to even - the `equal_half_even` split rule. */
function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (numerator < ZERO) return -roundHalfEven(-numerator, denominator);
  const quotient = numerator / denominator;
  const twiceRemainder = (numerator % denominator) * TWO;
  if (twiceRemainder > denominator || (twiceRemainder === denominator && quotient % TWO !== ZERO)) return quotient + BigInt(1);
  return quotient;
}

type BillFigures = Pick<BillView, "subtotalMinor" | "taxMinor" | "taxBreakdown" | "discountMinor" | "pricesIncludeTax" | "gstSplitRounding" | "totalMinor">;

/**
 * The bill's tax and total as finalize will compute them (restiq-web#369,
 * AP-pe-6 / AP-se-20). The backend only recomputes tax on the discounted value
 * inside the finalize call (bill-core.ts commitFinalize, SE-2), so while a
 * discount is pending the settle screen does the same maths: GST on
 * net = subtotal - discount, split by the tenant's `gstSplitRounding`
 * (restiq-backend#244): `exact_total` (also null/missing) rounds the total GST
 * once and gives CGST = floor(half), SGST = the remainder; `equal_half_up` /
 * `equal_half_even` round each line on its own, and the tax is their sum. Inclusive pricing (AU) backs the GST out of the discounted price and
 * never adds it on top. A bill with no rated breakdown (composition scheme,
 * older bills) keeps its own taxMinor. With no pending discount - or once the
 * bill carries its own `discountMinor` - the server's figures stand as sent.
 */
export function billFigures(bill: BillFigures, pendingDiscountMinor = 0): Pick<BillView, "taxMinor" | "taxBreakdown" | "totalMinor"> {
  if (bill.discountMinor !== null || pendingDiscountMinor <= 0) {
    return { taxMinor: bill.taxMinor, taxBreakdown: bill.taxBreakdown, totalMinor: bill.totalMinor };
  }
  const net = BigInt(bill.subtotalMinor - pendingDiscountMinor);
  const rated = (bill.taxBreakdown ?? []).filter((line) => line.ratePercent > 0);
  if (rated.length === 0) {
    const totalMinor = bill.pricesIncludeTax ? net : net + BigInt(bill.taxMinor);
    return { taxMinor: bill.taxMinor, taxBreakdown: bill.taxBreakdown, totalMinor: Number(totalMinor) };
  }
  const basisPoints = rated.map((line) => BigInt(Math.round(line.ratePercent * 100)));
  const rateBasis = basisPoints.reduce((sum, bp) => sum + bp, ZERO);
  const split = bill.gstSplitRounding;
  if (!bill.pricesIncludeTax && (split === "equal_half_up" || split === "equal_half_even")) {
    const round = split === "equal_half_up" ? roundHalfUp : roundHalfEven;
    const amounts = basisPoints.map((bp) => round(net * bp, BASIS_POINTS));
    const taxMinor = amounts.reduce((sum, amount) => sum + amount, ZERO);
    const taxBreakdown = rated.map((line, i) => ({ ...line, amountMinor: Number(amounts[i]) }));
    return { taxMinor: Number(taxMinor), taxBreakdown, totalMinor: Number(net + taxMinor) };
  }
  const taxMinor = bill.pricesIncludeTax
    ? net - roundHalfUp(net * BASIS_POINTS, BASIS_POINTS + rateBasis)
    : roundHalfUp(net * rateBasis, BASIS_POINTS);
  // Every line but the last gets floor(its share); the last takes the remainder.
  let allocated = ZERO;
  const taxBreakdown = rated.map((line, i) => {
    const amount = i === rated.length - 1 ? taxMinor - allocated : (taxMinor * basisPoints[i]) / rateBasis;
    allocated += amount;
    return { ...line, amountMinor: Number(amount) };
  });
  const totalMinor = bill.pricesIncludeTax ? net : net + taxMinor;
  return { taxMinor: Number(taxMinor), taxBreakdown, totalMinor: Number(totalMinor) };
}

/** The payable total - `billFigures`' total; `pendingDiscountMinor` previews a discount not yet submitted. */
export function billTotalMinor(bill: BillFigures, pendingDiscountMinor = 0): number {
  return billFigures(bill, pendingDiscountMinor).totalMinor;
}

/** Finalize is disabled until the pending tenders exactly cover the total - `bill-core.ts`'s `commitFinalize` rejects any other sum with a 400 `tender_mismatch`, this mirrors that gate client-side, same posture as `order-taking-state.ts`'s `canSendToKitchen`. */
export function canFinalizeBill(bill: Pick<BillView, "status">, totalMinor: number, tenders: readonly PendingTender[]): boolean {
  return bill.status === "open" && tenders.length > 0 && pendingTenderedMinor(tenders) === totalMinor;
}

/** Once a bill is finalized, AD-14 forbids every mutation this screen offers (discount, tenders) - callers gate all mutation UI on this, not just the Finalize button. */
export function isBillReadOnly(bill: Pick<BillView, "status">): boolean {
  return bill.status === "finalized";
}
