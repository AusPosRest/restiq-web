// Pure Table Map & Ownership logic (CAP-2), kept free of React so tap-routing
// and grouping are unit-testable without a DOM - mirrors floor-plan-state.ts/
// menu-state.ts's split between logic and UI.
//
// RECONCILED (2026-08-27, restiq-web#61) against the real, merged
// restiq-backend `dev` contract (src/pos/orders/orders.controller.ts's
// `GET /pos/v1/outlets/:outletId/table-map` and orders.dtos.ts's
// `TableMapEntry`, read directly). This file's original self-authored guess
// (see git history) got several things wrong, all fixed here:
//  - the real endpoint is outlet-scoped (`outlets/:outletId/table-map`), not
//    the bare `table-map` path the old client called - that was this story's
//    reported 404.
//  - the real response is a flat `TableMapEntry[]`, not a `{ outletId,
//    currentStaff, floors, tables }` envelope - there is no floors list and
//    no currentStaff read anywhere in `getTableMap()`. `currentStaff` now
//    comes from the pos_staff cookie server-side (table-map/page.tsx, same
//    pattern open-orders/page.tsx already established), and floor grouping
//    is derived purely from each table's own `floorId` (see
//    `groupTablesByFloor` below).
//
// RECONCILED (2026-09-02, restiq-backend#96) - `TableMapEntry` now also
// carries `floorName` (the real Floor's name, joined server-side) alongside
// `floorId` - restiq-web#96's reported bug ("FLOOR 01a06107-…" rendering the
// raw id) is exactly the gap this closes. `groupTablesByFloor`'s heading is
// `floorName` now, `floorId` only as a last-resort fallback if the field is
// somehow missing - never the other way round.
//  - the real entry is flat (`tableId`/`floorId`/`label`/`seatCapacity`/
//    `status`/`orderId`/`ownerId`), not a nested `{ id, ..., order: {
//    id, ownerStaffId, ownerStaffName, openedAt } }` - no owner name, no
//    order-opened timestamp. `order.ownerStaffName`/`order.openedAt` are
//    gone; `deriveTapAction`'s `transfer_required` branch now names the raw
//    owner id (never fabricated), and the ageing/elapsed-time label is
//    dropped outright (`elapsedMinutes`/`formatElapsedLabel`/
//    `AGEING_THRESHOLD_MINUTES` removed) - the backend has no per-table
//    "opened at" to compute it from, and SPEC's boundary is explicit: drop
//    UI for a field the backend genuinely has no data for rather than
//    fabricate one.
//  - real `TableMapEntry.status` is two-valued (`occupied`/`empty`) only -
//    `needs_bill` is a real future status (orders.dtos.ts's own TODO: it
//    depends on a Bill model AD-14 hasn't introduced yet), so it's dropped
//    from this client until the backend can actually set it, not modeled as
//    a permanently-unreachable third case.

export type TableStatus = "empty" | "occupied";

/** The real, verified wire shape of one entry in `GET /pos/v1/outlets/:outletId/table-map`'s array response. */
export interface RawTableMapEntry {
  tableId: string;
  floorId: string;
  /** The Floor's real name (e.g. "Ground Floor"), joined server-side - see file header. */
  floorName: string;
  label: string;
  seatCapacity: number;
  status: TableStatus;
  orderId: string | null;
  ownerId: string | null;
}

export interface TableOrderSummary {
  id: string;
  /** Raw owner id - no staff-name lookup exists server-side yet, see file header. */
  ownerStaffId: string;
}

export interface TableMapEntry {
  id: string;
  floorId: string;
  floorName: string;
  label: string;
  seatCapacity: number;
  status: TableStatus;
  order: TableOrderSummary | null;
}

export function toTableMapEntry(raw: RawTableMapEntry): TableMapEntry {
  return {
    id: raw.tableId,
    floorId: raw.floorId,
    floorName: raw.floorName,
    label: raw.label,
    seatCapacity: raw.seatCapacity,
    status: raw.status,
    order: raw.orderId !== null && raw.ownerId !== null ? { id: raw.orderId, ownerStaffId: raw.ownerId } : null,
  };
}

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  empty: "Available",
  occupied: "Occupied",
};

/** Tailwind classes keyed by the DESIGN.md status tokens - color is never the only signal, every tile also renders TABLE_STATUS_LABEL as text. */
export const TABLE_STATUS_CLASS: Record<TableStatus, string> = {
  empty: "border-2 border-status-available bg-transparent text-status-available",
  occupied: "border border-status-occupied bg-status-occupied/90 text-white",
};

export interface FloorGroup {
  floorId: string;
  /** The floor's real name - see file header. Grouping key stays `floorId`, since two floors could share a name. */
  floorName: string;
  tables: TableMapEntry[];
}

/** Groups tables by floorId, preserving each floor's first-appearance order - there is no separate floor list to group against. */
export function groupTablesByFloor(tables: readonly TableMapEntry[]): FloorGroup[] {
  const order: string[] = [];
  const floorNames = new Map<string, string>();
  const byFloor = new Map<string, TableMapEntry[]>();
  for (const table of tables) {
    let bucket = byFloor.get(table.floorId);
    if (!bucket) {
      bucket = [];
      byFloor.set(table.floorId, bucket);
      floorNames.set(table.floorId, table.floorName);
      order.push(table.floorId);
    }
    bucket.push(table);
  }
  return order.map((floorId) => ({ floorId, floorName: floorNames.get(floorId) || floorId, tables: byFloor.get(floorId) ?? [] }));
}

// --- Tap routing. A tile's tap target is one action, decided purely from the
// table's current status and who's asking - EXPERIENCE.md's Priya flow: a
// second staff member's tap on someone else's occupied table must never
// silently open it, it must resolve to the explicit transfer step instead.

export type TapAction =
  | { type: "start_order" }
  | { type: "open_order"; orderId: string }
  | { type: "transfer_required"; orderId: string; ownerId: string };

export function deriveTapAction(table: TableMapEntry, currentStaffId: string): TapAction {
  if (table.status === "empty" || table.order === null) return { type: "start_order" };
  if (table.order.ownerStaffId === currentStaffId) return { type: "open_order", orderId: table.order.id };
  return { type: "transfer_required", orderId: table.order.id, ownerId: table.order.ownerStaffId };
}
