"use client";

// TableShape (DESIGN.md component patterns): "floor-map tile: number, seat
// count, status color, elapsed time". The elapsed-time part is dropped here -
// see table-map-state.ts's RECONCILED header: the real backend's
// TableMapEntry carries no per-table "opened at" to compute it from, and
// nothing is fabricated in its place. Color is the primary signal but never
// the only one (Accessibility Floor: "each TableShape status also carries a
// text label under standard contrast") - every tile renders TABLE_STATUS_LABEL
// as visible text alongside its color, not just as an aria-label.
import { TABLE_STATUS_CLASS, TABLE_STATUS_LABEL, type TableMapEntry } from "./table-map-state";

export function TableTile({ table, onTap }: Readonly<{ table: TableMapEntry; onTap: () => void }>) {
  return (
    <button
      type="button"
      data-testid={`table-tile-${table.id}`}
      data-status={table.status}
      onClick={onTap}
      className={`flex min-h-24 min-w-24 flex-col items-center justify-center gap-1 rounded-lg p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${TABLE_STATUS_CLASS[table.status]}`}
    >
      <span className="font-headline text-lg font-semibold">{table.label}</span>
      <span data-testid={`table-tile-status-${table.id}`} className="font-label text-xs font-semibold uppercase tracking-wider opacity-90">
        {TABLE_STATUS_LABEL[table.status]}
      </span>
      <span className="text-xs tabular-nums opacity-80">{table.seatCapacity} seats</span>
    </button>
  );
}
