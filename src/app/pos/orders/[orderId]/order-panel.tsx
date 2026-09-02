"use client";

// OrderPanel (DESIGN.md: "right rail: line items, qty steppers"). Every line
// shows who added it (SPEC CAP-3 success criterion: "every line records
// which staff member added it").
//
// Product decision (2026-09-02, restiq-web#120): the CAP-4 "Split by seat"
// toggle and per-line seat steppers, and the seat-based send-to-kitchen gate,
// are removed - seats are optional metadata only now (see
// order-taking-state.ts's canSendToKitchen).
//
// The footer's "Settle" link is CAP-7 Bill & Settle's entry point
// (story 8/#53) - the order-taking screen itself never computes tax or
// discounts (see computeOrderTotalMinor's own comment), it only hands off.
// It sits below Send to kitchen rather than gated behind `firedAt` - this
// story didn't add that dependency and nothing in either story's task list
// asked for it; flagged here for whoever reconciles CAP-4/CAP-7 next, same
// discipline as this doc's other cross-story integration notes.
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canSendToKitchen, computeOrderTotalMinor, formatPriceMinor, orderOriginLabel, type OrderLineView, type OrderView } from "./order-taking-state";

export interface OrderPanelProps {
  /** The Order's real id - CAP-3 has no gapless bill-number concept (that's CAP-7's Bill), so the header shows a short display slice of the real id, not a fabricated sequence number. */
  orderId: string;
  tableId: OrderView["tableId"];
  tableLabel: OrderView["tableLabel"];
  currency: string;
  lines: OrderLineView[];
  status: OrderView["status"];
  /** The signed-in staff member's own id - shows "You" instead of a raw id on a line this staff member added, same convention as open-orders-screen.tsx's isOwnOrder. */
  currentStaffId: string;
  busyLineId: string | null;
  onIncrement: (line: OrderLineView) => void;
  onDecrement: (line: OrderLineView) => void;
  onRemove: (line: OrderLineView) => void;
  sendingToKitchen: boolean;
  onSendToKitchen: () => void;
}

export function OrderPanel({
  orderId,
  tableId,
  tableLabel,
  currency,
  lines,
  status,
  currentStaffId,
  busyLineId,
  onIncrement,
  onDecrement,
  onRemove,
  sendingToKitchen,
  onSendToKitchen,
}: Readonly<OrderPanelProps>) {
  const totalMinor = computeOrderTotalMinor(lines);
  const canSend = canSendToKitchen({ lines, status });
  const sendButtonLabel = status === "closed" ? "Closed" : status === "sent" ? "Sent to kitchen" : sendingToKitchen ? "Sending…" : "Send to kitchen";

  return (
    <aside data-testid="order-panel" className="flex w-80 shrink-0 flex-col border-l border-border/60 bg-card">
      <header className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <p className="font-headline text-sm font-semibold text-foreground">Order #{orderId.slice(-6).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">{orderOriginLabel({ tableId, tableLabel })}</p>
        </div>
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
                    <p data-testid={`order-line-added-by-${line.id}`} className="text-[11px] text-muted-foreground/80">
                      Added by {line.addedByStaffId === currentStaffId ? "You" : line.addedByStaffId}
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

        <button
          type="button"
          data-testid="send-to-kitchen"
          disabled={!canSend || sendingToKitchen}
          onClick={onSendToKitchen}
          className="mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sendButtonLabel}
        </button>

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
