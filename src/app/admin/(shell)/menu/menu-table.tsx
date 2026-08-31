"use client";

// T4/T4a Menu Management item list: 86 toggle per row, dine-in/delivery price
// columns. Price is fetched per item (GET .../price?channel=X - the only
// price read the real backend exposes, see menu-state.ts's file header) once
// the row mounts; an item with variants shows "Varies by variant" instead of
// fetching every variant's price for every list row.
import { GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchCurrentPrice } from "../../api";
import { EightySixToggle } from "./eighty-six-toggle";
import { formatPriceMinor, ItemView } from "./menu-state";

export function MenuTable({
  items,
  currency,
  onSelect,
  onAvailabilityChanged,
}: Readonly<{ items: ItemView[]; currency: string; onSelect: (item: ItemView) => void; onAvailabilityChanged: (itemId: string, available: boolean) => void }>) {
  return (
    <table data-testid="menu-table" className="w-full text-sm">
      <thead className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <tr className="h-12 border-b border-border/40">
          <th className="w-6" />
          <th className="px-3">Item</th>
          <th className="px-3 text-right">Dine-in</th>
          <th className="px-3 text-right">Delivery</th>
          <th className="px-3">Variants</th>
          <th className="px-3 text-center">86&apos;d</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <MenuTableRow key={item.id} item={item} currency={currency} onSelect={onSelect} onAvailabilityChanged={onAvailabilityChanged} />
        ))}
      </tbody>
    </table>
  );
}

function MenuTableRow({
  item,
  currency,
  onSelect,
  onAvailabilityChanged,
}: Readonly<{ item: ItemView; currency: string; onSelect: (item: ItemView) => void; onAvailabilityChanged: (itemId: string, available: boolean) => void }>) {
  const hasVariants = item.variants.length > 0;
  const [price, setPrice] = useState<{ dineInPriceMinor: number | null; deliveryPriceMinor: number | null }>({
    dineInPriceMinor: null,
    deliveryPriceMinor: null,
  });

  useEffect(() => {
    if (hasVariants) return;
    let cancelled = false;
    Promise.all([fetchCurrentPrice(item.id, { channel: "dine_in" }), fetchCurrentPrice(item.id, { channel: "delivery" })])
      .then(([dineIn, delivery]) => {
        if (!cancelled) setPrice({ dineInPriceMinor: dineIn?.priceMinor ?? null, deliveryPriceMinor: delivery?.priceMinor ?? null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [item.id, hasVariants]);

  return (
    <tr
      data-testid={`menu-item-row-${item.id}`}
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(item);
      }}
      className={`h-12 cursor-pointer border-b border-border/20 transition-colors last:border-b-0 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
        !item.available ? "opacity-60" : ""
      }`}
    >
      <td className="pl-3 text-muted-foreground">
        <GripVertical className="size-4" aria-hidden="true" />
      </td>
      <td className="px-3">
        <div className="flex items-center gap-2">
          <p className="font-medium">{item.name}</p>
          {!item.available && (
            <span data-testid={`menu-item-row-${item.id}-86-badge`} className="rounded-full bg-status-error/15 px-2 py-0.5 text-xs text-status-error">
              86&apos;d
            </span>
          )}
        </div>
      </td>
      <td className="px-3 text-right tabular-nums">
        {hasVariants ? <span className="text-xs text-muted-foreground">Varies</span> : price.dineInPriceMinor === null ? "-" : formatPriceMinor(price.dineInPriceMinor, currency)}
      </td>
      <td className="px-3 text-right tabular-nums">
        {hasVariants ? <span className="text-xs text-muted-foreground">Varies</span> : price.deliveryPriceMinor === null ? "-" : formatPriceMinor(price.deliveryPriceMinor, currency)}
      </td>
      <td className="px-3">
        {hasVariants ? (
          <div className="flex flex-wrap gap-1">
            {item.variants.map((variant) => (
              <span key={variant.id} className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                {variant.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Standard</span>
        )}
      </td>
      <td className="px-3 text-center">
        <EightySixToggle itemId={item.id} itemName={item.name} available={item.available} onChanged={(next) => onAvailabilityChanged(item.id, next)} />
      </td>
    </tr>
  );
}
