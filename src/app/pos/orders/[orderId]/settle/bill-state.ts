// Pure logic & types for P8 Bill & Settle (CAP-7, story 8). Kept
// framework-free so tax/discount/remaining-to-settle math is unit-testable
// without a DOM - same split as order-taking-state.ts/shift-state.ts.
//
// SELF-AUTHORED CONTRACT, not yet verified against a real backend.
// restiq-backend#59 ("Bill and settle (CAP-7)") was open with no branch and
// no commits when this was built - confirmed via `gh issue view 59 --repo
// AusPosRest/restiq-backend` (open, unstarted) and `gh api
// repos/AusPosRest/restiq-backend/branches` (only dev/main/
// feature/15-device-fleet exist). The issue body itself flags this as a
// "greenfield Bill/Tender models, AD-14 insert-only, gapless outlet-scoped
// numbering" build, so unlike e.g. CAP-3's order lines there is no real
// schema anywhere yet to read.
//
// Design basis: restiq-design's P8 mock
// (design/screens/pos-core-loop/restiq-bill-settle-order-1042--a6cdc714.png
// on the design/pull-stitch-screens branch of the restiq-design repo).
// `docs/specs/spec-pos-cashier-waiter/SPEC.md` and
// `docs/ux/ux-pos-cashier-waiter-2026-08-25/` (DESIGN.md/EXPERIENCE.md), both
// referenced by this story's brief, do not exist anywhere in restiq-design
// (checked every branch's full tree) - only `design-system.md` and the
// screen mocks under `design/screens/pos-core-loop` do. The mock's tax block
// (CGST 2.5% / SGST 2.5% of the post-discount subtotal, then a rounding line
// to the nearest rupee) is reproduced exactly since it is the only concrete
// tax rule available anywhere - `TenantTaxRegistration.taxProfile` (the real,
// merged tenant-admin schema) exists but has no computation logic anywhere
// yet to read or reuse. Split-bill (by seat/item/equal/amount, also visible
// in the mock) is deliberately not built - it isn't in this story's task
// list (YAGNI).
//
// Bill numbering ("TN1-000482" in the mock) is a gapless, outlet-scoped
// sequence per the issue body; this client never fabricates one - it only
// ever displays whatever `billNumber` the (self-authored) GET response
// carries.
//
// The 10% manager-approval discount threshold below is this story's own
// judgment call (task: "below-threshold: plain reason field; above-threshold:
// routes through the reused ManagerPinDialog" - no numeric threshold given
// anywhere) chosen so the mock's own 10% discount (shown with a "Manager
// approved" tag) sits exactly on the boundary. MUST be reconciled against
// restiq-backend#59's actual threshold (if any) once it lands.
//
// Discount is percent-only (matches the mock's own "Discount 10%" line
// exactly) - a fixed-amount discount isn't shown anywhere in the mock or
// asked for in the task, so it isn't built here (YAGNI).
import type { OrderLineView } from "../order-taking-state";

export type BillStatus = "draft" | "finalised";
export type BillTenderMethod = "cash" | "upi";

export const TENDER_METHOD_LABEL: Record<BillTenderMethod, string> = {
  cash: "Cash",
  upi: "UPI",
};

export interface BillTaxLineView {
  label: string;
  ratePercent: number;
  amountMinor: number;
}

export interface BillDiscountView {
  percentValue: number;
  amountMinor: number;
  reasonCode: string;
  reasonLabel: string;
  managerApproved: boolean;
}

export interface BillTenderView {
  id: string;
  method: BillTenderMethod;
  amountMinor: number;
  capturedAt: string;
}

export interface BillView {
  id: string;
  billNumber: string;
  orderId: string;
  tableLabel: string;
  currency: string;
  status: BillStatus;
  lines: OrderLineView[];
  subtotalMinor: number;
  discount: BillDiscountView | null;
  taxLines: BillTaxLineView[];
  roundOffMinor: number;
  grandTotalMinor: number;
  tenders: BillTenderView[];
  tenderedMinor: number;
  remainingMinor: number;
  finalisedAt: string | null;
}

export interface ApplyDiscountInput {
  percentValue: number;
  reasonCode: string;
  /** Present only on the above-threshold path (ManagerPinDialog's approved PIN). */
  managerPin?: string;
}

export interface AddTenderInput {
  method: BillTenderMethod;
  amountMinor: number;
}

/** Manager-approval boundary (see file header) - a discount at or above this percent must route through ManagerPinDialog rather than the plain reason field. */
export const DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT = 10;

export function discountRequiresManagerApproval(percentValue: number): boolean {
  return percentValue >= DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT;
}

/** Finalize is disabled until tenders exactly cover the grand total (task's exact rule) - never allows over-tendering to silently finalize either. */
export function canFinalizeBill(bill: Pick<BillView, "status" | "tenderedMinor" | "grandTotalMinor">): boolean {
  return bill.status === "draft" && bill.tenderedMinor === bill.grandTotalMinor;
}

/** Once a bill is finalised, AD-14 forbids every mutation this screen offers (discount, tenders) - callers gate all mutation UI on this, not just the Finalize button. */
export function isBillReadOnly(bill: Pick<BillView, "status">): boolean {
  return bill.status === "finalised";
}
