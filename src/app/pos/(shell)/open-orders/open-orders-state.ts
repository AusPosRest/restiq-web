// Pure Open & Held Orders logic (CAP-5, SPEC.md P6): the outlet-wide list of
// every non-closed Order, letting staff resume their own or take over
// someone else's via story 3's existing transferOrder action (reused, not
// reimplemented - stories.yaml story 6: "this screen is a list view over
// existing Order state, not a new ownership mechanism"). Kept free of React,
// same split as table-map-state.ts/shift-state.ts, so it's unit-testable
// without a DOM.
//
// RECONCILED (2026-08-27, restiq-web#60) against the real, merged
// restiq-backend `dev` contract (src/pos/orders/orders.controller.ts's
// `GET /pos/v1/outlets/:outletId/orders` and orders.dtos.ts's `OrderView`,
// read directly - restiq-backend#53 has since landed). Two things the
// original self-authored guess got wrong, both fixed here:
//  - the endpoint returns a bare `RawOpenOrder[]`, not a `{ outletId, orders }`
//    envelope - open-orders-screen.tsx was reading `data.orders`, always
//    `undefined` against the real payload (the reported crash).
//  - the real `OrderView` has no table label, staff name, item count, or
//    total - only `tableId`/`ownerId` (raw ids, no server-side join) and
//    `lines` (quantity/unitPriceMinor/modifiers, always present now that
//    CAP-3 order-lines has landed, so itemCount/totalMinor are always
//    derivable - the old "null until CAP-3 lands" case no longer applies).
//    `toOpenOrderEntry` below derives itemCount/totalMinor from `lines`
//    (reusing order-taking-state.ts's `computeUnitTotalMinor` - same
//    unitPrice+modifiers formula, not re-derived) and falls back to the raw
//    id for tableLabel/ownerStaffId until a staff-name/table-label lookup
//    exists server-side (flagged separately, same gap affects
//    table-map-state.ts). There's no separate `ownerStaffName` field - it'd
//    just be a second copy of the same raw id until that lookup exists;
//    callers show "You" for the viewer's own orders (isOwnOrder) and the raw
//    id otherwise.
//
// "Open and held" is SPEC/UX language for "every non-closed Order" - the
// real Order model only has open/sent/closed statuses, no distinct "held"
// status, so this never fabricates one: both open and sent orders show up
// here, closed ones never do - the real backend's listOpenOrders applies
// that same `status: { not: 'closed' }` filter server-side.

import { computeUnitTotalMinor } from "../../orders/[orderId]/order-taking-state";

export type OrderOrigin = "table" | "counter";
export type OpenOrderStatus = "open" | "sent";

/** One line as the real backend returns it - only what this list view needs to derive itemCount/totalMinor. */
export interface RawOpenOrderLine {
  quantity: number;
  unitPriceMinor: number;
  modifiers: { priceMinor: number }[];
}

/** The real, verified wire shape of one entry in `GET /pos/v1/outlets/:outletId/orders`'s array response. */
export interface RawOpenOrder {
  id: string;
  /** null for a CAP-6 counter order. */
  tableId: string | null;
  ownerId: string;
  status: OpenOrderStatus;
  /** ISO timestamp. */
  createdAt: string;
  lines: RawOpenOrderLine[];
}

export interface OpenOrderEntry {
  id: string;
  origin: OrderOrigin;
  /** Present only when origin === "table"; null for a counter-origin order. Raw table id - no label lookup exists server-side yet, see file header. */
  tableLabel: string | null;
  /** Raw owner id - no staff-name lookup exists server-side yet, see file header. Callers compare against currentStaffId (isOwnOrder) to show "You" instead of the raw id for the viewer's own orders. */
  ownerStaffId: string;
  status: OpenOrderStatus;
  /** ISO timestamp - mirrors table-map-state.ts's TableOrderSummary.openedAt naming. */
  openedAt: string;
  itemCount: number;
  totalMinor: number;
}

function lineTotalMinor(line: RawOpenOrderLine): number {
  return line.quantity * computeUnitTotalMinor(line.unitPriceMinor, line.modifiers);
}

export function toOpenOrderEntry(raw: RawOpenOrder): OpenOrderEntry {
  return {
    id: raw.id,
    origin: raw.tableId === null ? "counter" : "table",
    tableLabel: raw.tableId,
    ownerStaffId: raw.ownerId,
    status: raw.status,
    openedAt: raw.createdAt,
    itemCount: raw.lines.reduce((sum, line) => sum + line.quantity, 0),
    totalMinor: raw.lines.reduce((sum, line) => sum + lineTotalMinor(line), 0),
  };
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
  totalMinor: number;
}

export function summarize(orders: readonly OpenOrderEntry[]): OpenOrdersSummary {
  return { count: orders.length, totalMinor: orders.reduce((sum, order) => sum + order.totalMinor, 0) };
}
