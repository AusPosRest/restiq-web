// Typed client-side access to the backend API via the /pos/api pass-through.
// Mirrors admin/api.ts's shape (AdminApiError -> PosApiError, adminApi ->
// posApi). See table-map/table-map-state.ts's file header for why every
// path below is a self-authored, not-yet-verified contract.
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
