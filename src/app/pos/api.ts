// Typed client-side access to the backend API via the /pos/api pass-through.
// Mirrors admin/api.ts's shape (AdminApiError -> PosApiError, adminApi ->
// posApi). See table-map/table-map-state.ts's file header for why the
// table-map/order endpoints below are a self-authored, not-yet-verified
// contract. clockOut hits the real, verified restiq-backend contract instead
// (feature/44-pos-auth-clock's src/pos/clock/clock.controller.ts, read
// directly) - see src/app/pos/auth/login/route.ts's header for how the rest
// of CAP-1's login contract was verified.
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

export interface OrderStubView {
  id: string;
  tableId: string;
  tableLabel: string;
  status: "occupied" | "needs_bill";
  ownerStaffId: string;
  ownerStaffName: string;
  openedAt: string;
}

/** Backs the story-4 placeholder route (/pos/orders/[orderId]) - enough to prove the id round-trips, nothing about order lines. */
export function fetchOrder(orderId: string): Promise<OrderStubView> {
  return posApi<OrderStubView>(`orders/${orderId}`);
}

export type { TableMapView };

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
