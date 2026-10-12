"use client";

// T4/T4a Menu Management item list: Available switch per row, one price column
// (dine-in channel; no delivery price, #272). Price is fetched per item (GET .../price?channel=X - the only
// price read the real backend exposes, see menu-state.ts's file header) once
// the row mounts; an item with variants shows "Varies by variant" instead of
// fetching every variant's price for every list row.
import { GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { PaginationControls, usePagination } from "@/components/pagination";
import { fetchCurrentPrice } from "../../api";
import { EightySixToggle } from "./eighty-six-toggle";
import { formatPriceMinor, ItemView } from "./menu-state";

export function MenuTable({
  items,
  currency,
  filterKey,
  priceOverrides,
  onSelect,
  onAvailabilityChanged,
}: Readonly<{
  items: ItemView[];
  currency: string;
  /** Changes whenever the category/search filter changes, so the pager returns to page 1 (issue #255). */
  filterKey?: string;
  /** Issue #330: a price the drawer just changed in this session, keyed by item id. */
  priceOverrides?: Record<string, number>;
  onSelect: (item: ItemView) => void;
  onAvailabilityChanged: (itemId: string, available: boolean) => void;
}>) {
  const pager = usePagination(items, filterKey);
  return (
    <>
    <table data-testid="menu-table" className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-card text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <tr className="h-12 border-b border-border/40">
          <th className="w-6" />
          <th className="px-3">Item</th>
          <th className="px-3 text-right">Price</th>
          <th className="px-3">Variants</th>
          <th className="px-3 text-center">Available</th>
        </tr>
      </thead>
      <tbody>
        {pager.items.map((item) => (
          <MenuTableRow key={item.id} item={item} currency={currency} priceOverride={priceOverrides?.[item.id]} onSelect={onSelect} onAvailabilityChanged={onAvailabilityChanged} />
        ))}
      </tbody>
    </table>
    <PaginationControls pager={pager} testId="menu-pagination" />
    </>
  );
}

function MenuTableRow({
  item,
  currency,
  priceOverride,
  onSelect,
  onAvailabilityChanged,
}: Readonly<{
  item: ItemView;
  currency: string;
  priceOverride?: number;
  onSelect: (item: ItemView) => void;
  onAvailabilityChanged: (itemId: string, available: boolean) => void;
}>) {
  const hasVariants = item.variants.length > 0;
  const [fetchedPriceMinor, setFetchedPriceMinor] = useState<number | null>(null);
  const priceMinor = priceOverride ?? fetchedPriceMinor;

  useEffect(() => {
    if (hasVariants) return;
    let cancelled = false;
    fetchCurrentPrice(item.id, { channel: "dine_in" })
      .then((price) => {
        if (!cancelled) setFetchedPriceMinor(price?.priceMinor ?? null);
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
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- owner-supplied https or data: URLs, not something next/image's optimizer can handle
            <img data-testid={`menu-item-row-${item.id}-photo`} src={item.photoUrl} alt="" loading="lazy" className="size-9 shrink-0 rounded-md object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="font-medium">{item.name}</p>
          {!item.available && (
            <span data-testid={`menu-item-row-${item.id}-86-badge`} className="rounded-full bg-status-error/15 px-2 py-0.5 text-xs text-status-error">
              Sold out
            </span>
          )}
        </div>
      </td>
      <td className="px-3 text-right tabular-nums">
        {hasVariants ? <span className="text-xs text-muted-foreground">Varies</span> : priceMinor === null ? "-" : formatPriceMinor(priceMinor, currency)}
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
