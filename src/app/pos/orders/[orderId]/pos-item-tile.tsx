"use client";

// POSItemTile (DESIGN.md: "grid tile: item name, price, veg/non-veg dot" -
// the veg/non-veg dot is omitted, see order-taking-state.ts's file header
// for why). An unavailable (86'd) item is shown, not hidden, but disabled -
// same "state is always visible, never a silent gap" pattern as table-map's
// TableTile.
import { formatPriceMinor, resolveUnitPriceMinor, type PosMenuItemView } from "./order-taking-state";

export function PosItemTile({ item, currency, onTap }: Readonly<{ item: PosMenuItemView; currency: string; onTap: () => void }>) {
  const hasVariants = item.variants.length > 0;
  const displayPriceMinor = hasVariants ? Math.min(...item.variants.map((v) => v.priceMinor)) : resolveUnitPriceMinor(item, null);

  return (
    <button
      type="button"
      data-testid={`item-tile-${item.id}`}
      disabled={!item.available}
      onClick={onTap}
      className="flex min-h-24 flex-col justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-card"
    >
      <span className="font-headline text-sm font-semibold text-foreground">{item.name}</span>
      <span className="flex items-center justify-between">
        <span className="tabular-nums text-sm font-semibold text-primary">
          {hasVariants ? "from " : ""}
          {formatPriceMinor(displayPriceMinor, currency)}
        </span>
        {!item.available && (
          <span data-testid={`item-tile-unavailable-${item.id}`} className="font-label text-[10px] font-semibold uppercase tracking-wider text-status-alert">
            86&apos;d
          </span>
        )}
      </span>
    </button>
  );
}
