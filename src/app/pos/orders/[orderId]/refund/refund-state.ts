// Pure logic & types for P10 Refund & Adjustments (CAP-9, story 10). Kept
// framework-free per this codebase's *-state.ts convention (bill-state.ts,
// order-taking-state.ts, shift-state.ts) so refund-total math is
// unit-testable without a DOM.
//
// SELF-AUTHORED CONTRACT, not yet verified against a real backend.
// restiq-backend#63 ("Refunds and adjustments (CAP-9)") had no branch and no
// commits when this was built (`gh api repos/AusPosRest/restiq-backend/branches`
// and `gh pr list`/`gh api repos/AusPosRest/restiq-web/pulls` both checked -
// only unrelated feature branches exist). Built directly from SPEC.md's
// CAP-9 ("a refund never mutates the original Bill - it is issued as a
// separate, linked credit note read alongside the original Bill's totals,
// never overwriting them") and the P10 mock
// (restiq-design/design/screens/pos-core-loop/restiq-refund-adjustments-bill-tn1-000482--50f49f87.png)
// alone. MUST be reconciled against the real contract once #63 lands.
//
// Reuses the already-finalised BillView (bill-state.ts) as the "original
// invoice" - refunding only ever targets a finalised bill, and the existing
// GET (`orders/:id/bill`, story 8) already returns every original line + tax
// line this screen needs. No new read endpoint is invented for it.
//
// Refund math mirrors the P10 mock exactly: tax reversal is the combined
// rate across the original bill's tax lines (CGST 2.5% + SGST 2.5% = 5%)
// applied to the refunded subtotal - the same "flat combined rate on
// subtotal" rule bill-state.ts established for the forward direction, run in
// reverse (2 x Butter Naan @ Rs60 -> Rs120 subtotal, Rs6 tax reversal, Rs126
// total - exactly the mock's numbers). Discount is not reproportioned into
// the refund (not shown in the mock, not asked for in the task - YAGNI);
// revisit once the real backend's actual reversal rule is read.
//
// CAP-9 refunds are always manager-gated (SPEC CAP-8 lists refund as one of
// the six gated actions, with no below-threshold exception unlike CAP-7's
// discount) - so unlike discount-dialog.tsx there is no plain-reason path
// here at all; the mandatory reason code always comes from the reused
// ManagerPinDialog's own reason-code select (see refund-config-panel.tsx).
import type { OrderLineView } from "../order-taking-state";
import type { BillTaxLineView, BillView } from "../settle/bill-state";

export type RefundMethod = "cash" | "upi";

export const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
  cash: "Cash",
  upi: "UPI Reversal",
};

/** Selected refund quantity per original bill line id; a line absent (or 0) isn't part of the refund. */
export type RefundSelection = Record<string, number>;

export function toggleLineSelected(selection: RefundSelection, line: OrderLineView, selected: boolean): RefundSelection {
  const next = { ...selection };
  if (selected) next[line.id] = next[line.id] || line.quantity;
  else delete next[line.id];
  return next;
}

/** Clamped to [1, line.quantity] - a refund can never exceed what was originally billed. */
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

function combinedTaxRatePercent(taxLines: readonly BillTaxLineView[]): number {
  return taxLines.reduce((sum, tax) => sum + tax.ratePercent, 0);
}

export function computeRefundTotals(bill: Pick<BillView, "lines" | "taxLines">, selection: RefundSelection): RefundTotals {
  const lines: RefundLineTotal[] = bill.lines
    .filter((line) => (selection[line.id] ?? 0) > 0)
    .map((line) => {
      const quantity = Math.min(selection[line.id], line.quantity);
      return { line, quantity, amountMinor: Math.round(line.unitPriceMinor * quantity) };
    });
  const subtotalMinor = lines.reduce((sum, entry) => sum + entry.amountMinor, 0);
  const taxReversalMinor = Math.round((subtotalMinor * combinedTaxRatePercent(bill.taxLines)) / 100);
  return { lines, subtotalMinor, taxReversalMinor, totalMinor: subtotalMinor + taxReversalMinor };
}

export function hasRefundSelection(selection: RefundSelection): boolean {
  return Object.values(selection).some((quantity) => quantity > 0);
}

export interface CreateRefundLineInput {
  lineId: string;
  quantity: number;
}

export function toRefundLineInputs(selection: RefundSelection): CreateRefundLineInput[] {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([lineId, quantity]) => ({ lineId, quantity }));
}

export interface CreateRefundInput {
  lines: CreateRefundLineInput[];
  refundMethod: RefundMethod;
  reasonCode: string;
  notes?: string;
  /** The ManagerPinDialog-approved PIN - refund is always gated (see file header), so this is always present, unlike CAP-7 discount's optional field. */
  managerPin: string;
}

export interface CreditNoteLineView {
  id: string;
  lineId: string;
  itemName: string;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}

/** AD-14 insert-only: a credit note, never a mutated Bill (SPEC CAP-9's success criterion). */
export interface CreditNoteView {
  id: string;
  creditNoteNumber: string;
  billId: string;
  billNumber: string;
  orderId: string;
  currency: string;
  lines: CreditNoteLineView[];
  subtotalMinor: number;
  taxReversalMinor: number;
  totalMinor: number;
  refundMethod: RefundMethod;
  reasonCode: string;
  reasonLabel: string;
  notes: string | null;
  issuedAt: string;
}

/** Only a finalised bill can be refunded - nothing about an in-progress draft bill makes sense to refund. Callers gate the whole mutation UI on this. */
export function canRefundBill(bill: Pick<BillView, "status">): boolean {
  return bill.status === "finalised";
}
