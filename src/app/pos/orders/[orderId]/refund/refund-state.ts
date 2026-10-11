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
//    entirely to mean "refund everything not already refunded", plus an
//    optional `method` (restiq-backend#221) - how the money went back, see
//    `RefundChoice` below.
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
import { TENDER_METHOD_LABEL, type BillTenderMethod, type BillTenderView, type BillView } from "../settle/bill-state";

/** How the money goes back to the guest - the four choices the refund screen offers (restiq-web#353). */
export type RefundChoice = "cash" | "card" | "upi" | "external";

export const REFUND_CHOICES: { value: RefundChoice; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "external", label: "External" },
];

function choiceFor(method: BillTenderMethod): RefundChoice {
  if (method.startsWith("card_")) return "card";
  if (method.startsWith("upi_")) return "upi";
  return method === "cash" ? "cash" : "external";
}

/** The bill's main tender - its largest, earliest on a tie (the same default the server uses). */
function mainTender(tenders: readonly BillTenderView[]): BillTenderView | null {
  return tenders.reduce<BillTenderView | null>((best, t) => (!best || t.amountMinor > best.amountMinor ? t : best), null);
}

/** Defaults the refund to how the bill was paid. */
export function defaultRefundChoice(tenders: readonly BillTenderView[]): RefundChoice {
  const main = mainTender(tenders);
  return main ? choiceFor(main.method) : "cash";
}

/** The tender method sent to the server: the bill's own card/UPI method when it matches the choice (a refund to the same card), else the manual one. */
export function refundMethodFor(choice: RefundChoice, tenders: readonly BillTenderView[]): BillTenderMethod {
  const main = mainTender(tenders);
  if (main && choiceFor(main.method) === choice) return main.method;
  return ({ cash: "cash", card: "card_terminal", upi: "upi_manual", external: "external" } as const)[choice];
}

/** "Cash", "Card terminal", ... - or "Not recorded" for a credit note issued before the method was kept. */
export function refundMethodLabel(method: BillTenderMethod | null): string {
  return method ? TENDER_METHOD_LABEL[method] : "Not recorded";
}

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

/** What the preview needs from the original bill to pro-rate a refund the way the server does (restiq-backend#207/#221). */
export type RefundBillTotals = Pick<BillView, "subtotalMinor" | "discountMinor" | "taxMinor" | "pricesIncludeTax">;

/**
 * Without `bill`: gross lines plus the flat placeholder tax. With it: the
 * server's own pro-rating - the selection's share of the bill's discounted
 * subtotal and of its stored tax, each rounded down (exact for a first
 * refund; the server's figure on the credit note is the source of truth).
 */
export function computeRefundTotals(lines: readonly OrderLineView[], selection: RefundSelection, bill?: RefundBillTotals): RefundTotals {
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

  const grossMinor = selected.reduce((sum, entry) => sum + entry.amountMinor, 0);
  if (bill && bill.subtotalMinor > 0) {
    const subtotalMinor = Math.floor((grossMinor * (bill.subtotalMinor - (bill.discountMinor ?? 0))) / bill.subtotalMinor);
    const taxReversalMinor = Math.floor((grossMinor * bill.taxMinor) / bill.subtotalMinor);
    return { lines: selected, subtotalMinor, taxReversalMinor, totalMinor: bill.pricesIncludeTax ? subtotalMinor : subtotalMinor + taxReversalMinor };
  }
  const taxReversalMinor = Math.round((grossMinor * REFUND_TAX_RATE_PERCENT) / 100);
  return { lines: selected, subtotalMinor: grossMinor, taxReversalMinor, totalMinor: grossMinor + taxReversalMinor };
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
  /** How the money went back; the server defaults it to the bill's main tender when omitted. */
  method?: BillTenderMethod;
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
  /** How the money went back; null on a note issued before this was recorded (restiq-backend#221). */
  method: BillTenderMethod | null;
  createdAt: string;
  /** Each line's amount is net of its share of the bill discount, so they add up to subtotalMinor. */
  lines: CreditNoteLineView[];
}

/** Only a finalized bill can be refunded - nothing about an in-progress open bill makes sense to refund. Callers gate the whole mutation UI on this. */
export function canRefundBill(bill: { status: string }): boolean {
  return bill.status === "finalized";
}
