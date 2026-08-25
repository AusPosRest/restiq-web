// Typed client-side access to the backend API via the /pos/api pass-through.
// Mirrors admin/api.ts's shape (AdminApiError -> PosApiError, adminApi ->
// posApi). See table-map/table-map-state.ts's file header for why the
// table-map/order endpoints below are a self-authored, not-yet-verified
// contract. clockOut hits the real, verified restiq-backend contract instead
// (feature/44-pos-auth-clock's src/pos/clock/clock.controller.ts, read
// directly) - see src/app/pos/auth/login/route.ts's header for how the rest
// of CAP-1's login contract was verified.
//
// --- CAP-3 Order taking with modifiers/variants (menu read + order-line
// writes) - see orders/[orderId]/order-taking-state.ts's file header for the
// full self-authored-contract reasoning (restiq-backend#52 has no branch
// yet). fetchOrder/OrderStubView (story 3's placeholder, "enough to prove
// the id round-trips, nothing about order lines") are replaced outright by
// fetchOrderDetail/OrderView below, which carry real lines and a total.
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
import type { TableMapEntry, TableMapView } from "./table-map/table-map-state";

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

// GET is read via useTableMapLoad() directly (that hook exists precisely for
// this GET-and-render shape, mirroring useAdminLoad/useOpsLoad).

/** Tap an empty table: opens a new Order owned by the current (session-resolved) staff member. */
export function startOrder(tableId: string): Promise<TableMapEntry> {
  return posApi<TableMapEntry>(`tables/${tableId}/start-order`, { method: "POST" });
}

/**
 * The explicit transfer action (stories.yaml story 3: "a named action, not an
 * implicit reassignment"; SPEC CAP-2: "must go through an explicit transfer
 * action naming the new owner"). Reason is optional - transfer is audited
 * (actor + reason) same as other mutations, but it isn't one of CAP-8's six
 * manager-gated actions, so no PIN and no required reason.
 */
export function transferOrder(orderId: string, reason?: string): Promise<TableMapEntry> {
  return posApi<TableMapEntry>(`orders/${orderId}/transfer`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export type { TableMapView };
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
} from "./orders/[orderId]/order-taking-state";
import type { AddOrderLineInput, OrderView, PosMenuView } from "./orders/[orderId]/order-taking-state";

/** GET /pos/v1/menu - items/categories/modifier groups with a single dine-in price already resolved server-side. */
export function fetchMenu(): Promise<PosMenuView> {
  return posApi<PosMenuView>("menu");
}

/** GET /pos/v1/orders/:id - the real P3 order-taking screen's read, with lines and a running total (replaces story 3's OrderStubView). */
export function fetchOrderDetail(orderId: string): Promise<OrderView> {
  return posApi<OrderView>(`orders/${orderId}`);
}

/** POST /pos/v1/orders/:id/lines - rejected server-side (not just client-validated) if a modifier group's min/max is violated (SPEC CAP-3 success criterion). Attribution (which staff member added it) is resolved server-side from the bearer token, never sent from the client. */
export function addOrderLine(orderId: string, input: AddOrderLineInput): Promise<OrderView> {
  return posApi<OrderView>(`orders/${orderId}/lines`, { method: "POST", body: JSON.stringify(input) });
}

export function updateOrderLineQuantity(orderId: string, lineId: string, quantity: number): Promise<OrderView> {
  return posApi<OrderView>(`orders/${orderId}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
}

/**
 * CAP-4 group ordering: assigns (or, with `null`, clears) a line's seat
 * number. Reuses story 4's real, merged `PATCH .../lines/:lineId` endpoint
 * rather than a new route - see order-taking-state.ts's CAP-4 header for
 * why (issue #58's own framing: "extends story 4's real, merged line
 * add/edit endpoints with an optional seatNumber field").
 */
export function assignSeat(orderId: string, lineId: string, seatNumber: number | null): Promise<OrderView> {
  return posApi<OrderView>(`orders/${orderId}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ seatNumber }) });
}

/**
 * CAP-4's "send to kitchen" action - `PATCH .../status {status:'sent'}` is
 * a real, already-merged endpoint (`orders.controller.ts`/`orders.service.ts`
 * on restiq-backend `dev`, verified directly); issue #58 (not yet started)
 * only adds a 400 to it when any line lacks a seat, per SPEC CAP-4's success
 * criterion - order-taking-state.ts's `canSendToKitchen` mirrors that gate
 * client-side so this call should only ever be reached once it would
 * succeed.
 */
export function sendOrderToKitchen(orderId: string): Promise<OrderView> {
  return posApi<OrderView>(`orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status: "sent" }) });
}

export function removeOrderLine(orderId: string, lineId: string): Promise<OrderView> {
  return posApi<OrderView>(`orders/${orderId}/lines/${lineId}`, { method: "DELETE" });
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
// SELF-AUTHORED CONTRACT, not yet verified against a real backend. The
// paired backend story (issue #54, branch feature/54-pos-device-status) had
// no branch and no commits at the time this was built - `gh api
// repos/AusPosRest/restiq-backend/branches` listed only dev/main/
// feature/15-device-fleet. restiq-backend's dev branch does have the real
// ClockEvent model and clock-out endpoint (src/pos/clock/*, verified by
// reading the actual tree) but no endpoint that lists clock events back out -
// only the write side exists so far.
//
// This shape is this story's best guess, built directly from SPEC CAP-11
// ("who is clocked in on this device today" - "no fabricated staff or
// times") and stories.yaml story 11 ("real ClockEvent rows from story 1...
// static 'connected' placeholder, clearly not a live peripheral check"):
// one GET returning today's attendance (derived server-side from ClockEvent
// rows the same way CAP-1 already writes them - staffId/type/occurredAt) and
// a `device` object that is deliberately never anything but a static mock,
// never presented as live telemetry (DESIGN.md/EXPERIENCE.md's honesty
// pattern for PrinterStatusChip/OfflineIndicatorPill).
//
// MUST be reconciled against the real restiq-backend#54 DTOs once that
// lands - same discipline as table-map-state.ts's file header.

export interface AttendanceEntry {
  staffId: string;
  staffName: string;
  /** ISO timestamp of today's clock-in (outlet-local calendar day, per CAP-1's clock.util.ts convention). */
  clockInAt: string;
  /** null while still clocked in - the only clock write CAP-1's UI makes is clock-out. */
  clockOutAt: string | null;
}

export type PrinterStatus = "connected" | "disconnected";
export type ConnectivityStatus = "online" | "offline";

/** Always mocked (SPEC CAP-11, DESIGN.md): no real printer or connectivity signal exists in this prototype. */
export interface PosDeviceStatus {
  printer: PrinterStatus;
  connectivity: ConnectivityStatus;
}

export interface AttendanceView {
  outletId: string;
  /** Newest first. Empty is a real, valid state (no one clocked in yet today), never fabricated rows. */
  staff: AttendanceEntry[];
  device: PosDeviceStatus;
}

export function getAttendanceToday(outletId: string): Promise<AttendanceView> {
  return posApi<AttendanceView>(`outlets/${encodeURIComponent(outletId)}/attendance/today`);
}

// --- CAP-7 Bill & Settle (story 8, issue #53 web / #59 backend). See
// orders/[orderId]/settle/bill-state.ts's file header for the full
// self-authored-contract reasoning (restiq-backend#59 has no branch yet).
export type {
  AddTenderInput,
  ApplyDiscountInput,
  BillDiscountView,
  BillTaxLineView,
  BillTenderMethod,
  BillTenderView,
  BillView,
} from "./orders/[orderId]/settle/bill-state";
import type { AddTenderInput, ApplyDiscountInput, BillView } from "./orders/[orderId]/settle/bill-state";

/** GET /pos/v1/orders/:id/bill - the real endpoint should lazily materialise a draft Bill from the Order's current lines on first read if none exists yet (this client never creates one explicitly). */
export function fetchBill(orderId: string): Promise<BillView> {
  return posApi<BillView>(`orders/${orderId}/bill`);
}

/** POST /pos/v1/orders/:id/bill/discount - below CAP-8's threshold this is the whole call; at/above it, `managerPin` carries the ManagerPinDialog-approved PIN alongside the same reasonCode (now sourced from the dialog's reason-code select instead of the plain field). */
export function applyBillDiscount(orderId: string, input: ApplyDiscountInput): Promise<BillView> {
  return posApi<BillView>(`orders/${orderId}/bill/discount`, { method: "POST", body: JSON.stringify(input) });
}

export function addBillTender(orderId: string, input: AddTenderInput): Promise<BillView> {
  return posApi<BillView>(`orders/${orderId}/bill/tenders`, { method: "POST", body: JSON.stringify(input) });
}

/** Rejected (409, surfaced via PosApiError) if tenders don't exactly cover the grand total - canFinalizeBill() already keeps the button disabled in that case, this is the server-side backstop. */
export function finalizeBill(orderId: string): Promise<BillView> {
  return posApi<BillView>(`orders/${orderId}/bill/finalize`, { method: "POST" });
}
