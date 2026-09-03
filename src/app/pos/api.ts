// Typed client-side access to the backend API via the /pos/api pass-through.
// Mirrors admin/api.ts's shape (AdminApiError -> PosApiError, adminApi ->
// posApi). table-map/table-map-state.ts and orders/[orderId]/
// order-taking-state.ts's file headers cover the RECONCILED (2026-08-27,
// restiq-web#61) real backend contracts the table-map/order endpoints below
// now target. clockOut hits the real, verified restiq-backend contract
// (feature/44-pos-auth-clock's src/pos/clock/clock.controller.ts, read
// directly) - see src/app/pos/auth/login/route.ts's header for how the rest
// of CAP-1's login contract was verified.
//
// RECONCILED (2026-09-02, restiq-web#98) - every remaining self-authored
// path below (bill/settle, refund, counter order, attendance) against the
// real, merged restiq-backend contract (src/pos/{bills,orders,clock}/*, read
// directly). See each section's own comment for what specifically was
// wrong; ./orders/[orderId]/settle/bill-state.ts and
// ./orders/[orderId]/refund/refund-state.ts's file headers cover the full
// bill/refund reasoning.
//
// --- CAP-3 Order taking with modifiers/variants (menu read + order-line
// writes). Every mutation below returns the real wire shape (`RawOrder`)
// mapped through order-taking-state.ts's `toOrderView` into the display
// shape (`OrderView`) callers already render - an optional trailing `menu`
// param lets a caller with a loaded menu in scope (order-taking-view.tsx,
// counter-view.tsx) get real item/variant names on the mapped lines;
// callers with no menu in scope (table-map.tsx's startOrder/transferOrder,
// which never render a line) simply get raw-id-fallback names, since they
// never look at `.lines` at all.
//
// --- CAP-10 Shift & cash management. Verified against restiq-backend's real
// feature/45-shift-cash-management branch (src/pos/shifts/shifts.controller.ts
// / shifts.dtos.ts / shifts.service.ts, read directly - not merged to
// restiq-backend/dev yet but real and pushed, same posture as CAP-1's
// clockOut above). The one load-bearing shape decision AD-14 forces: a
// pre-close ShiftView must never carry an expected-cash field. The real
// backend's own ShiftView actually includes countedMinor/expectedMinor/
// overShortMinor on every response, always null until a close happens - this
// client-side ShiftView type simply omits those three keys entirely (extra
// JSON fields are ignored), so no code reading a pre-close ShiftView can
// reference an expected amount even though the wire payload technically
// carries the (null) keys. closeShift()'s response is typed separately
// (ClosedShift) precisely because that's the one call where those fields are
// real, non-null values.
export class PosApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function posApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/pos/api/${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new PosApiError("The API could not be reached", 0);
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new PosApiError(error?.message ?? "The request failed", res.status, error?.code);
  }
  return body as T;
}

// GET is read via usePosLoad() directly (that hook exists precisely for
// this GET-and-render shape, mirroring useAdminLoad/useOpsLoad).

export type {
  AddOrderLineInput,
  OrderLineView,
  OrderView,
  PosMenuCategoryView,
  PosMenuItemView,
  PosMenuVariantView,
  PosMenuView,
  PosModifierGroupView,
  PosModifierView,
  RawOrder,
} from "./orders/[orderId]/order-taking-state";
import type { AddOrderLineInput, OrderView, PosMenuView, RawOrder } from "./orders/[orderId]/order-taking-state";
import { toOrderView } from "./orders/[orderId]/order-taking-state";

/** Tap an empty table: opens (or, per orders.controller.ts's `openOrClaimTable`, returns the existing) Order for that table, owned by the current (session-resolved) staff member. Returns the raw wire shape - table-map.tsx never renders a line, so there's no menu in scope to join item/variant names against. */
export function startOrder(outletId: string, tableId: string): Promise<RawOrder> {
  return posApi<RawOrder>(`outlets/${outletId}/tables/${tableId}/order`, { method: "POST" });
}

/**
 * The explicit transfer action (stories.yaml story 3: "a named action, not an
 * implicit reassignment"; SPEC CAP-2: "must go through an explicit transfer
 * action naming the new owner"). `newOwnerStaffId` is required - the real
 * `TransferOrderDto` requires it (confirmed live via a real 400,
 * "newOwnerStaffId must be a UUID"). Reason is optional - transfer is
 * audited (actor + reason) same as other mutations, but it isn't one of
 * CAP-8's six manager-gated actions, so no PIN and no required reason.
 */
export function transferOrder(orderId: string, newOwnerStaffId: string, reason?: string): Promise<RawOrder> {
  return posApi<RawOrder>(`orders/${orderId}/transfer`, {
    method: "POST",
    body: JSON.stringify(reason ? { newOwnerStaffId, reason } : { newOwnerStaffId }),
  });
}

/** GET /pos/v1/menu - items/categories/modifier groups with a single dine-in price already resolved server-side. */
export function fetchMenu(): Promise<PosMenuView> {
  return posApi<PosMenuView>("menu");
}

/** POST /pos/v1/orders/:id/lines - rejected server-side (not just client-validated) if a modifier group's min/max is violated (SPEC CAP-3 success criterion). Attribution (which staff member added it) is resolved server-side from the bearer token, never sent from the client. `menu` is optional - see this file's header. */
export function addOrderLine(orderId: string, input: AddOrderLineInput, menu?: Pick<PosMenuView, "items">): Promise<OrderView> {
  return posApi<RawOrder>(`orders/${orderId}/lines`, { method: "POST", body: JSON.stringify(input) }).then((raw) => toOrderView(raw, menu));
}

export function updateOrderLineQuantity(orderId: string, lineId: string, quantity: number, menu?: Pick<PosMenuView, "items">): Promise<OrderView> {
  return posApi<RawOrder>(`orders/${orderId}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }).then((raw) => toOrderView(raw, menu));
}

/**
 * CAP-4 group ordering: assigns (or, with `null`, clears) a line's seat
 * number. Reuses story 4's real, merged `PATCH .../lines/:lineId` endpoint
 * rather than a new route - see order-taking-state.ts's CAP-4 header for
 * why (issue #58's own framing: "extends story 4's real, merged line
 * add/edit endpoints with an optional seatNumber field").
 */
export function assignSeat(orderId: string, lineId: string, seatNumber: number | null, menu?: Pick<PosMenuView, "items">): Promise<OrderView> {
  return posApi<RawOrder>(`orders/${orderId}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ seatNumber }) }).then((raw) => toOrderView(raw, menu));
}

/**
 * CAP-4's "send to kitchen" action - `PATCH .../status {status:'sent'}` is a
 * real, merged endpoint (`orders.controller.ts`/`orders.service.ts`,
 * verified directly) that 400s when any line lacks a seat, per SPEC CAP-4's
 * success criterion - order-taking-state.ts's `canSendToKitchen` mirrors
 * that gate client-side so this call should only ever be reached once it
 * would succeed.
 */
export function sendOrderToKitchen(orderId: string, menu?: Pick<PosMenuView, "items">): Promise<OrderView> {
  return posApi<RawOrder>(`orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status: "sent" }) }).then((raw) => toOrderView(raw, menu));
}

export function removeOrderLine(orderId: string, lineId: string, menu?: Pick<PosMenuView, "items">): Promise<OrderView> {
  return posApi<RawOrder>(`orders/${orderId}/lines/${lineId}`, { method: "DELETE" }).then((raw) => toOrderView(raw, menu));
}

/**
 * CAP-6 QSR counter mode (story 7, issue #56 web / #62 backend). Starts a
 * fresh counter order - no table, no seat - issuing a new sequential token
 * number in the same call, per SPEC CAP-6's success criterion.
 *
 * RECONCILED (2026-09-02, restiq-web#98) against the real, merged
 * restiq-backend `createCounterOrder` (`orders.controller.ts`, read
 * directly): the real route is outlet-scoped
 * (`POST outlets/:outletId/counter-orders`, 201) - the old guess
 * (`POST orders/counter`, no outlet) never existed. Returns the same raw
 * wire shape (`RawOrder`) every other order mutation in this file does, not
 * an already-mapped `OrderView` - callers map it with `toOrderView` exactly
 * like `startOrder` above.
 */
export function startCounterOrder(outletId: string): Promise<RawOrder> {
  return posApi<RawOrder>(`outlets/${outletId}/counter-orders`, { method: "POST" });
}

export interface ClockEventView {
  id: string;
  type: "clock_in" | "clock_out";
  occurredAt: string;
}

/**
 * CAP-1's explicit "end my shift" action. Clock-in has no equivalent client
 * call - the real backend records it automatically on login (once per local
 * calendar day) rather than as a separate toggle, so this is the only clock
 * write CAP-1's UI ever makes.
 */
export function clockOut(): Promise<ClockEventView> {
  return posApi<ClockEventView>("clock/out", { method: "POST" });
}

export type CashMovementType = "paid_out" | "bank_drop";

export interface CashMovementView {
  id: string;
  type: CashMovementType;
  amountMinor: number;
  reason: string;
  createdAt: string;
}

/**
 * The shift's live, pre-close view. Deliberately has no expected-cash or
 * counted field of any kind (AD-14 blindness) - only ClosedShift, returned
 * from closeShift() itself, ever carries those values. See this file's
 * header for how that holds even though the real backend's wire payload
 * carries the (null) keys too.
 */
export interface ShiftView {
  id: string;
  outletId: string;
  openedAt: string;
  floatMinor: number;
  cashMovements: CashMovementView[];
}

/** closeShift()'s response only - the one place countedMinor/expectedMinor/overShortMinor are ever real values. */
export interface ClosedShift {
  id: string;
  closedAt: string;
  countedMinor: number;
  expectedMinor: number;
  overShortMinor: number;
}

export async function getCurrentShift(outletId: string): Promise<ShiftView | null> {
  try {
    return await posApi<ShiftView>(`shifts/current?outletId=${encodeURIComponent(outletId)}`);
  } catch (error) {
    if (error instanceof PosApiError && error.status === 404) return null;
    throw error;
  }
}

export function getShift(shiftId: string): Promise<ShiftView> {
  return posApi<ShiftView>(`shifts/${shiftId}`);
}

export function openShift(outletId: string, floatMinor: number): Promise<ShiftView> {
  return posApi<ShiftView>("shifts", { method: "POST", body: JSON.stringify({ outletId, floatMinor }) });
}

export function logCashMovement(shiftId: string, type: CashMovementType, amountMinor: number, reason: string): Promise<ShiftView> {
  return posApi<ShiftView>(`shifts/${shiftId}/cash-movements`, { method: "POST", body: JSON.stringify({ type, amountMinor, reason }) });
}

export function closeShift(shiftId: string, countedMinor: number): Promise<ClosedShift> {
  return posApi<ClosedShift>(`shifts/${shiftId}/close`, { method: "POST", body: JSON.stringify({ countedMinor }) });
}

// --- CAP-11 Device and staff attendance status (story 11, issue #48).
//
// RECONCILED (2026-09-02, restiq-web#98) against the real, merged
// restiq-backend contract (src/pos/clock/{attendance.controller.ts,
// attendance.service.ts,attendance.dtos.ts}, read directly). What the
// original self-authored guess got wrong:
//  - the real route is `GET outlets/:outletId/attendance`, not
//    `.../attendance/today`.
//  - `staff` only ever lists staff *currently* clocked in (the latest
//    ClockEvent per staff member, today, being a clock_in with no later
//    clock_out - `attendance.service.ts`'s own filter, read directly) - there
//    is no clocked-out entry to show, ever, so there's no `clockOutAt` field
//    to carry. Sorted by name, not newest-first.
//  - the mocked printer placeholder is `printerStatus: {status, mocked}` at
//    the top level (`MockedPrinterStatus`), not nested under a `device`
//    object, and `status` is a true literal type - `"connected"` is the only
//    value the real backend can ever send (SPEC.md: "no real ESC/POS printer
//    ... integration").
//  - there is no connectivity/offline signal anywhere in this response (or
//    anywhere else in pos/*) - the old `device.connectivity` field had no
//    backing data at all, not even a mocked one. `status/device-status-
//    screen.tsx` now passes `OfflineIndicatorPill` a permanently-static
//    "online" prop instead of reading a fabricated response field, keeping
//    DESIGN.md's two-chip layout without inventing a wire value for it.
export interface AttendanceEntry {
  staffId: string;
  name: string;
  /** ISO timestamp of today's clock-in (outlet-local calendar day, per CAP-1's clock.util.ts convention). Always present - see file header, only currently-clocked-in staff appear here at all. */
  clockedInAt: string;
}

/** The real backend can only ever report "connected" (attendance.dtos.ts's `MockedPrinterStatus`, read directly) - no real printer integration exists in this prototype. */
export type PrinterStatus = "connected";

export interface AttendanceView {
  outletId: string;
  asOf: string;
  /** Sorted by name. Empty is a real, valid state (no one clocked in yet today), never fabricated rows. */
  staff: AttendanceEntry[];
  printerStatus: { status: PrinterStatus; mocked: true };
}

export function getAttendanceToday(outletId: string): Promise<AttendanceView> {
  return posApi<AttendanceView>(`outlets/${encodeURIComponent(outletId)}/attendance`);
}

// --- CAP-7 Bill & Settle (story 8, issue #53 web / #59 backend). See
// orders/[orderId]/settle/bill-state.ts's file header for the full
// reconciliation reasoning (restiq-web#98) against the real, merged
// restiq-backend `src/pos/bills/*`.
export type {
  BillStatus,
  BillTenderMethod,
  BillTenderView,
  BillView,
  FinalizeBillInput,
  PendingDiscount,
  PendingTender,
} from "./orders/[orderId]/settle/bill-state";
import type { FinalizeBillInput, BillView } from "./orders/[orderId]/settle/bill-state";

/**
 * Create-or-fetch the Bill for an order. `POST orders/:orderId/bill`
 * (bills.controller.ts's `create`, read directly) is the only way in - there
 * is no `GET` keyed by orderId. restiq-backend#98 made this endpoint
 * idempotent per order: a repeat call for an order that already has a Bill
 * (open or finalized) returns 200 with that same `BillView` instead of
 * throwing, so a plain POST is all a fresh tab ever needs - `posApi` already
 * treats both 200 and 201 as success. Only a genuinely closed order with no
 * Bill ever created still 409s, and that propagates to the caller as-is.
 */
export function fetchOrCreateBill(orderId: string): Promise<BillView> {
  return posApi<BillView>(`orders/${orderId}/bill`, { method: "POST" });
}

export function getBill(billId: string): Promise<BillView> {
  return posApi<BillView>(`bills/${billId}`);
}

/**
 * Submits every pending discount + tender together (`FinalizeBillDto`) -
 * the real backend has no separate discount/tender endpoints, see
 * bill-state.ts's file header. Rejected (400 `tender_mismatch`) if the
 * tenders don't exactly sum to the total - `canFinalizeBill()` already keeps
 * the button disabled in that case, this is the server-side backstop.
 */
export function finalizeBill(billId: string, input: FinalizeBillInput): Promise<BillView> {
  return posApi<BillView>(`bills/${billId}/finalize`, { method: "POST", body: JSON.stringify(input) });
}

// --- CAP-9 Refunds and adjustments (story 10, issue #57 web / #63 backend).
// See orders/[orderId]/refund/refund-state.ts's file header for the full
// reconciliation reasoning (restiq-web#98) against the real, merged
// restiq-backend `src/pos/bills/*`. The original bill is read via
// `getBill()`/`fetchOrCreateBill()` above - no separate read endpoint exists
// for it.
export type { CreateRefundInput, CreditNoteView } from "./orders/[orderId]/refund/refund-state";
import type { CreateRefundInput, CreditNoteView } from "./orders/[orderId]/refund/refund-state";

/** POST /pos/v1/bills/:id/refund (bills.controller.ts's `refund`, read directly - targets the Bill, not the Order). CAP-8-gated (managerPin always required, see refund-state.ts). Never mutates the original Bill (AD-14/CAP-9) - returns a new, separate CreditNoteView instead of a BillView. */
export function createRefund(billId: string, input: CreateRefundInput): Promise<CreditNoteView> {
  return posApi<CreditNoteView>(`bills/${billId}/refund`, { method: "POST", body: JSON.stringify(input) });
}

// --- Printable tax invoice (issue #137 web / restiq-backend#103, merged via
// restiq-backend PR #105). `GET bills/:id/invoice` returns one fully
// server-computed InvoiceView - every total/tax-breakdown/tender/credit-note
// figure already resolved, so `bills/[billId]/invoice/bill-invoice-view.tsx`
// only formats and prints it. 409 `not_finalized` while the bill is still
// open; 404 for any other unreachable/unknown bill id.
export interface InvoiceSellerView {
  legalEntityName: string;
  registrationLabel: "GSTIN" | "ABN";
  registrationNumber: string;
  fssaiLicense?: string | null;
  outletName: string;
  outletAddress: string;
}

export interface InvoiceLineView {
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface InvoiceTaxBreakdownView {
  label: string;
  ratePercent: number;
  amountMinor: number;
}

export interface InvoiceTenderView {
  method: string;
  amountMinor: number;
  createdAt: string;
}

export interface InvoiceCreditNoteView {
  id: string;
  amountMinor: number;
  reason: string;
  createdAt: string;
}

export interface InvoiceView {
  invoiceNumber: string;
  title: "Tax Invoice" | "Invoice";
  issuedAt: string;
  currency: string;
  seller: InvoiceSellerView;
  lines: InvoiceLineView[];
  subtotalMinor: number;
  discountMinor: number | null;
  discountReason: string | null;
  taxBreakdown: InvoiceTaxBreakdownView[];
  taxMinor: number;
  totalMinor: number;
  pricesIncludeTax: boolean;
  tenders: InvoiceTenderView[];
  creditNotes: InvoiceCreditNoteView[];
  notes: string[];
}

export function fetchInvoice(billId: string): Promise<InvoiceView> {
  return posApi<InvoiceView>(`bills/${billId}/invoice`);
}
