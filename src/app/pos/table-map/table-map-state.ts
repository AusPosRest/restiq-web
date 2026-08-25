// Pure Table Map & Ownership logic (CAP-2), kept free of React so tap-routing
// and grouping are unit-testable without a DOM - mirrors floor-plan-state.ts/
// menu-state.ts's split between logic and UI.
//
// SELF-AUTHORED CONTRACT, not yet verified against a real backend. Two
// upstream facts this depends on had not landed when this story (issue #40,
// branch feature/40-table-map-ownership) was built, both confirmed by reading
// the actual working trees, not a summary:
//  - restiq-backend issue #46 ("Table map and order ownership/transfer",
//    branch feature/46-table-map-ownership) had no branch and no commits -
//    `git log`/`git branch -a` on restiq-backend showed only `dev`, and the
//    only table-shaped model anywhere is DiningTable (from Tenant Admin's
//    floor-plan work, CAP-5) - no Order model, no /pos/v1 module at all.
//  - restiq-web's own CAP-1 story (issue #38, "POS auth realm, PIN login",
//    branch feature/38-pos-pin-login) was cut from `dev` but had zero
//    POS-specific commits - no /pos/login screen exists to issue a real
//    pos_session cookie yet (see src/lib/pos-session.ts's file header).
//
// This file's types are this story's best-guess contract, built directly
// from SPEC.md (CAP-2's three statuses: empty/occupied/needs-bill) and
// stories.yaml story 3 ("reuse the existing Floor/DiningTable models... a
// greenfield Order model - base fields only, no lines yet"). Table status is
// therefore modeled as *derived* from whether an open Order exists for that
// table, never a stored column on DiningTable itself, so this never
// duplicates the table model stories.yaml explicitly forbids duplicating.
// "needs_bill" is included as a real status value the backend can set (once
// a later story adds a bill-request action) but nothing in this story's own
// UI ever transitions a table into it - there is no fake trigger for it here.
// "reserved" (shown in the Stitch mock) is deliberately not modeled: no
// capability in SPEC.md's eleven capabilities covers reservations, and
// EXPERIENCE.md's own rule is "spines win on conflict with any mock".
//
// MUST be reconciled against the real restiq-backend#46 DTOs once that lands
// - same discipline as wiki/features/tenant-admin.md's CAP-8 dashboard
// reconciliation.

export type TableStatus = "empty" | "occupied" | "needs_bill";

export interface StaffSummary {
  id: string;
  name: string;
}

export interface FloorView {
  id: string;
  name: string;
  sortOrder: number;
}

export interface TableOrderSummary {
  id: string;
  ownerStaffId: string;
  ownerStaffName: string;
  /** ISO timestamp - when this order was opened, used for the ageing/elapsed label. */
  openedAt: string;
}

export interface TableMapEntry {
  id: string;
  floorId: string;
  label: string;
  seatCapacity: number;
  status: TableStatus;
  order: TableOrderSummary | null;
}

export interface TableMapView {
  outletId: string;
  /** Resolved server-side from the pos session (SPEC: no client-side identity). */
  currentStaff: StaffSummary;
  floors: FloorView[];
  tables: TableMapEntry[];
}

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  empty: "Available",
  occupied: "Occupied",
  needs_bill: "Bill requested",
};

/** Tailwind classes keyed by the DESIGN.md status tokens - color is never the only signal, every tile also renders TABLE_STATUS_LABEL as text. */
export const TABLE_STATUS_CLASS: Record<TableStatus, string> = {
  empty: "border-2 border-status-available bg-transparent text-status-available",
  occupied: "border border-status-occupied bg-status-occupied/90 text-white",
  needs_bill: "border border-status-warning bg-status-warning/90 text-[#3d2c00]",
};

export interface FloorGroup {
  floor: FloorView;
  tables: TableMapEntry[];
}

export function groupTablesByFloor(floors: readonly FloorView[], tables: readonly TableMapEntry[]): FloorGroup[] {
  return floors.map((floor) => ({ floor, tables: tables.filter((table) => table.floorId === floor.id) }));
}

// --- Tap routing. A tile's tap target is one action, decided purely from the
// table's current status and who's asking - EXPERIENCE.md's Priya flow: a
// second staff member's tap on someone else's occupied table must never
// silently open it, it must resolve to the explicit transfer step instead.

export type TapAction =
  | { type: "start_order" }
  | { type: "open_order"; orderId: string }
  | { type: "transfer_required"; orderId: string; ownerName: string };

export function deriveTapAction(table: TableMapEntry, currentStaffId: string): TapAction {
  if (table.status === "empty" || table.order === null) return { type: "start_order" };
  if (table.order.ownerStaffId === currentStaffId) return { type: "open_order", orderId: table.order.id };
  return { type: "transfer_required", orderId: table.order.id, ownerName: table.order.ownerStaffName };
}

// --- Elapsed-time label. DESIGN.md/EXPERIENCE.md: "a small elapsed-time
// label appears once a table has been occupied past a threshold, echoing the
// 'ageing' semantic". No SPEC-defined threshold exists yet (same kind of gap
// as SPEC.md's Open Questions on the discount threshold) - 15 minutes is a
// documented assumption pending a real tenant setting.

export const AGEING_THRESHOLD_MINUTES = 15;

export function elapsedMinutes(openedAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000));
}

export function formatElapsedLabel(openedAt: string, now: Date = new Date()): string | null {
  const minutes = elapsedMinutes(openedAt, now);
  if (minutes < AGEING_THRESHOLD_MINUTES) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
