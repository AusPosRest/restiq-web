"use client";

// OrderPanel (DESIGN.md: "right rail: line items, qty steppers, seat/course
// tags"). Seat/course tags are CAP-4/group-ordering's addition (story 5,
// stories.yaml) - out of scope here, this story's Order/OrderLine has no
// seat field yet. Every line shows who added it (SPEC CAP-3 success
// criterion: "every line records which staff member added it").
//
// The footer's "Settle" link is CAP-7 Bill & Settle's entry point
// (story 8/#53) - the order-taking screen itself never computes tax or
// discounts (see computeOrderTotalMinor's own comment), it only hands off.
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeOrderTotalMinor, formatPriceMinor, type OrderLineView } from "./order-taking-state";

export interface OrderPanelProps {
  /** The Order's real id - CAP-3 has no gapless bill-number concept (that's CAP-7's Bill), so the header shows a short display slice of the real id, not a fabricated sequence number. */
  orderId: string;
  tableLabel: string;
  currency: string;
  lines: OrderLineView[];
  busyLineId: string | null;
  onIncrement: (line: OrderLineView) => void;
  onDecrement: (line: OrderLineView) => void;
  onRemove: (line: OrderLineView) => void;
}

export function OrderPanel({ orderId, tableLabel, currency, lines, busyLineId, onIncrement, onDecrement, onRemove }: Readonly<OrderPanelProps>) {
  const totalMinor = computeOrderTotalMinor(lines);

  return (
    <aside data-testid="order-panel" className="flex w-80 shrink-0 flex-col border-l border-border/60 bg-card">
      <header className="border-b border-border/60 px-4 py-3">
        <p className="font-headline text-sm font-semibold text-foreground">Order #{orderId.slice(-6).toUpperCase()}</p>
        <p className="text-xs text-muted-foreground">Table {tableLabel}</p>
      </header>

      <div data-testid="order-panel-lines" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <p data-testid="order-panel-empty" className="text-sm text-muted-foreground">
            No items yet - tap the menu to add the first one.
          </p>
        ) : (
          lines.map((line) => {
            const isBusy = busyLineId === line.id;
            return (
              <div key={line.id} data-testid={`order-line-${line.id}`} className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {line.itemName}
                      {line.variantName && <span className="text-muted-foreground"> · {line.variantName}</span>}
                    </p>
                    {line.modifiers.length > 0 && (
                      <p className="text-xs text-muted-foreground">{line.modifiers.map((modifier) => modifier.name).join(", ")}</p>
                    )}
                    {line.specialInstructions && <p className="text-xs italic text-muted-foreground">&ldquo;{line.specialInstructions}&rdquo;</p>}
                    <p data-testid={`order-line-added-by-${line.id}`} className="text-[11px] text-muted-foreground/80">
                      Added by {line.addedByStaffName}
                    </p>
                  </div>
                  <p className="tabular-nums text-sm font-semibold text-foreground">{formatPriceMinor(line.lineTotalMinor, currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid={`order-line-decrement-${line.id}`}
                    aria-label="Decrease quantity"
                    disabled={isBusy}
                    onClick={() => onDecrement(line)}
                    className="flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <span data-testid={`order-line-qty-${line.id}`} className="w-5 text-center text-sm font-semibold tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    data-testid={`order-line-increment-${line.id}`}
                    aria-label="Increase quantity"
                    disabled={isBusy}
                    onClick={() => onIncrement(line)}
                    className="flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-40"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-testid={`order-line-remove-${line.id}`}
                    aria-label="Remove line"
                    disabled={isBusy}
                    onClick={() => onRemove(line)}
                    className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-status-alert disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer className="border-t border-border/60 p-4">
        <div className="flex items-center justify-between">
          <span className="font-label text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
          <span data-testid="order-panel-total" className="tabular-nums text-lg font-bold text-foreground">
            {formatPriceMinor(totalMinor, currency)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Tax and discounts apply at Bill &amp; Settle.</p>
        {lines.length === 0 ? (
          <Button size="lg" className="mt-3 w-full" data-testid="go-to-settle" disabled>
            Settle
          </Button>
        ) : (
          <Button asChild size="lg" className="mt-3 w-full" data-testid="go-to-settle">
            <Link href={`/pos/orders/${orderId}/settle`}>Settle</Link>
          </Button>
        )}
      </footer>
    </aside>
  );
}
