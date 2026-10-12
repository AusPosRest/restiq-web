"use client";

// A combo in the POS item grid (restiq-web#264): same tile as an item, marked
// "Combo" with what it saves against buying the picks separately. A combo that
// can't be sold (switched off, or a slot has nothing left) is shown disabled.
import { comboSavingsMinor, type ComboItemInfo, type ComboMenuView } from "@/lib/combo";
import { formatPriceMinor } from "./order-taking-state";

export function PosComboTile({
  combo,
  itemsById,
  currency,
  onTap,
}: Readonly<{ combo: ComboMenuView; itemsById: ReadonlyMap<string, ComboItemInfo>; currency: string; onTap: () => void }>) {
  const savings = comboSavingsMinor(combo, itemsById);
  return (
    <button
      type="button"
      data-testid={`combo-tile-${combo.id}`}
      disabled={!combo.available}
      onClick={onTap}
      className="flex min-h-24 flex-col justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-left transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>
        <span className="font-label mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-primary">Combo</span>
        <span className="font-headline text-sm font-semibold text-foreground">{combo.name}</span>
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="tabular-nums text-sm font-semibold text-primary">{formatPriceMinor(combo.priceMinor, currency)}</span>
        {!combo.available ? (
          <span className="font-label text-[10px] font-semibold uppercase tracking-wider text-status-alert">Unavailable</span>
        ) : (
          savings > 0 && <span className="text-[11px] font-medium text-status-healthy">Save {formatPriceMinor(savings, currency)}</span>
        )}
      </span>
    </button>
  );
}
