// Pure Open & Held Orders logic (CAP-5, SPEC.md P6): the outlet-wide list of
// every non-closed Order, letting staff resume their own or take over
// someone else's via story 3's existing transferOrder action (reused, not
// reimplemented - stories.yaml story 6: "this screen is a list view over
// existing Order state, not a new ownership mechanism"). Kept free of React,
// same split as table-map-state.ts/shift-state.ts, so it's unit-testable
// without a DOM.
//
// SELF-AUTHORED CONTRACT, not yet verified against a real backend.
// restiq-backend issue #53 ("Open and held orders, outlet-wide") had no
// branch and no commits when this story was built - `git ls-remote` against
// restiq-backend's real remote showed only dev/main/feature/15-device-fleet,
// confirmed by reading the actual remote, not a summary. This story's
// best-guess GET endpoint (`outlets/${outletId}/orders`, see
// open-orders-screen.tsx) follows story 3's real, verified
// `GET /pos/v1/outlets/:outletId/table-map` shape (outlet scoped in the
// path) rather than story 3's own unreconciled `table-map` guess - see
// table-map-state.ts's file header for that still-open gap.
//
// "Open and held" is SPEC/UX language for "every non-closed Order" - the
// real Order model (restiq-backend's feature/46-table-map-ownership
// orders.service.ts, read directly) only has open/sent/closed statuses, no
// distinct "held" status, so this never fabricates one: both open and sent
// orders show up here, closed ones never do - mirrors story 3's own
// table-map query (`status: { not: 'closed' }`).
//
// itemCount/totalMinor are modeled as nullable, not required: CAP-3 (order
// lines, story 4/#52) may not be merged yet, so the backend may have no
// lines/pricing to summarize from. summarize() below only ever sums when
// every order in the list actually has a total, rather than showing a
// partial, misleading figure.
//
// MUST be reconciled against the real restiq-backend#53 DTOs once that
// lands - same discipline as table-map-state.ts's own pending reconciliation.

export type OrderOrigin = "table" | "counter";
export type OpenOrderStatus = "open" | "sent";

export interface OpenOrderEntry {
  id: string;
  origin: OrderOrigin;
  /** Present only when origin === "table"; null for a counter-origin order. */
  tableLabel: string | null;
  ownerStaffId: string;
  ownerStaffName: string;
  status: OpenOrderStatus;
  /** ISO timestamp - mirrors table-map-state.ts's TableOrderSummary.openedAt naming. */
  openedAt: string;
  /** null until CAP-3/order-lines exist for this order. */
  itemCount: number | null;
  /** null until pricing exists for this order (paise/minor units). */
  totalMinor: number | null;
}

export interface OpenOrdersView {
  outletId: string;
  orders: OpenOrderEntry[];
}

export const OPEN_ORDER_STATUS_LABEL: Record<OpenOrderStatus, string> = {
  open: "Open",
  sent: "Sent to kitchen",
};

export function isOwnOrder(order: OpenOrderEntry, currentStaffId: string): boolean {
  return order.ownerStaffId === currentStaffId;
}

export function originLabel(order: OpenOrderEntry): string {
  return order.origin === "table" ? `Table ${order.tableLabel ?? "?"}` : "Counter";
}

export function elapsedLabel(openedAt: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export interface OpenOrdersSummary {
  count: number;
  /** null unless every order in the list has a known total - never a partial/misleading sum. */
  totalMinor: number | null;
}

export function summarize(orders: readonly OpenOrderEntry[]): OpenOrdersSummary {
  const totalMinor = orders.every((o) => o.totalMinor !== null)
    ? orders.reduce((sum, o) => sum + (o.totalMinor ?? 0), 0)
    : null;
  return { count: orders.length, totalMinor };
}
