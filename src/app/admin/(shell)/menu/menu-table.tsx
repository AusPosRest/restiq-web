"use client";

// T4/T4a Menu Management item list: Available switch per row, one price column
// (dine-in channel; no delivery price, #272). Prices come inline on the item
// list (restiq-backend#211, SE-20) - no request per row. An item with variants
// shows its price range; one the till and QR can't sell says so (CU-23).
import { GripVertical } from "lucide-react";
import { PaginationControls, usePagination } from "@/components/pagination";
import { EightySixToggle } from "./eighty-six-toggle";
import { formatPriceMinor, ItemView, unsellableNote } from "./menu-state";

export function MenuTable({
  items,
  currency,
  filterKey,
  onSelect,
  onAvailabilityChanged,
}: Readonly<{
  items: ItemView[];
  currency: string;
  /** Changes whenever the category/search filter changes, so the pager returns to page 1 (issue #255). */
  filterKey?: string;
  onSelect: (item: ItemView) => void;
  onAvailabilityChanged: (itemId: string, available: boolean) => void;
}>) {
  const pager = usePagination(items, filterKey);
  return (
    <>
    <table data-testid="menu-table" className="w-full table-fixed text-sm">
      {/* Fixed column widths (CU-4): a "Sold out" pill must not shift the columns. */}
      <thead className="sticky top-0 z-10 bg-card text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <tr className="h-12 border-b border-border/40">
          <th className="w-9" />
          <th className="px-3">Item</th>
          <th className="w-36 px-3 text-right">Price</th>
          <th className="w-44 px-3">Variants</th>
          <th className="w-24 px-3 text-center">Available</th>
        </tr>
      </thead>
      <tbody>
        {pager.items.map((item) => (
          <MenuTableRow key={item.id} item={item} currency={currency} onSelect={onSelect} onAvailabilityChanged={onAvailabilityChanged} />
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
  onSelect,
  onAvailabilityChanged,
}: Readonly<{
  item: ItemView;
  currency: string;
  onSelect: (item: ItemView) => void;
  onAvailabilityChanged: (itemId: string, available: boolean) => void;
}>) {
  const hasVariants = item.variants.length > 0;
  const money = (minor: number) => formatPriceMinor(minor, item.currency ?? currency);
  const variantPrices = item.variants.flatMap((v) => (v.priceMinor === null ? [] : [v.priceMinor]));
  const low = Math.min(...variantPrices);
  const high = Math.max(...variantPrices);
  const price = !hasVariants
    ? item.priceMinor === null
      ? "-"
      : money(item.priceMinor)
    : variantPrices.length === 0
      ? "-"
      : low === high
        ? money(low)
        : `${money(low)} – ${money(high)}`;
  const note = unsellableNote(item);

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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{item.name}</p>
              {!item.available && (
                <span data-testid={`menu-item-row-${item.id}-86-badge`} className="shrink-0 rounded-full bg-status-error/15 px-2 py-0.5 text-xs text-status-error">
                  Sold out
                </span>
              )}
            </div>
            {note && (
              <p data-testid={`menu-item-row-${item.id}-unsellable`} className="text-xs text-status-warning">
                {note}
              </p>
            )}
          </div>
        </div>
      </td>
      <td data-testid={`menu-item-row-${item.id}-price`} className="px-3 text-right tabular-nums">
        {price}
      </td>
      <td className="px-3">
        {hasVariants ? (
          <div className="flex flex-wrap gap-1">
            {item.variants.map((variant) => (
              <span
                key={variant.id}
                className={`rounded-full px-2 py-0.5 text-xs ${variant.priceMinor === null ? "bg-status-warning/15 text-status-warning" : "bg-accent text-muted-foreground"}`}
              >
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
