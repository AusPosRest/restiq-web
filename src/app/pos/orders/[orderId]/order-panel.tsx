"use client";

// OrderPanel (DESIGN.md: "right rail: line items, qty steppers, seat/course
// tags"). Seat/course tags are CAP-4/group-ordering's addition (story 5,
// stories.yaml) - built here now: EXPERIENCE.md's IA calls this the "Split
// by seat" action off the order panel, so it's a per-line reveal in this
// same panel, not a separate P5 route (see order-taking-state.ts's CAP-4
// header for the full contract reasoning). Every line shows who added it
// (SPEC CAP-3 success criterion: "every line records which staff member
// added it").
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { canSendToKitchen, computeOrderTotalMinor, formatPriceMinor, unseatedLineCount, type OrderLineView, type OrderView } from "./order-taking-state";

export interface OrderPanelProps {
  /** The Order's real id - CAP-3 has no gapless bill-number concept (that's CAP-7's Bill), so the header shows a short display slice of the real id, not a fabricated sequence number. */
  orderId: string;
  tableLabel: string;
  currency: string;
  lines: OrderLineView[];
  /** CAP-4: whether the order has already been fired - null/absent beforehand, see order-taking-state.ts. */
  firedAt: OrderView["firedAt"];
  busyLineId: string | null;
  onIncrement: (line: OrderLineView) => void;
  onDecrement: (line: OrderLineView) => void;
  onRemove: (line: OrderLineView) => void;
  onSeatIncrement: (line: OrderLineView) => void;
  onSeatDecrement: (line: OrderLineView) => void;
  sendingToKitchen: boolean;
  onSendToKitchen: () => void;
}

export function OrderPanel({
  orderId,
  tableLabel,
  currency,
  lines,
  firedAt,
  busyLineId,
  onIncrement,
  onDecrement,
  onRemove,
  onSeatIncrement,
  onSeatDecrement,
  sendingToKitchen,
  onSendToKitchen,
}: Readonly<OrderPanelProps>) {
  const totalMinor = computeOrderTotalMinor(lines);
  const [splitBySeat, setSplitBySeat] = useState(false);
  const unseated = unseatedLineCount(lines);
  const canSend = canSendToKitchen({ lines, firedAt });

  return (
    <aside data-testid="order-panel" className="flex w-80 shrink-0 flex-col border-l border-border/60 bg-card">
      <header className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <p className="font-headline text-sm font-semibold text-foreground">Order #{orderId.slice(-6).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">Table {tableLabel}</p>
        </div>
        {lines.length > 0 && (
          <button
            type="button"
            data-testid="split-by-seat-toggle"
            aria-pressed={splitBySeat}
            onClick={() => setSplitBySeat((value) => !value)}
            className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
              splitBySeat ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Split by seat
          </button>
        )}
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
                {splitBySeat && (
                  <div className="flex items-center gap-2 border-t border-border/40 pt-1.5">
                    <span className="font-label text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Seat</span>
                    <button
                      type="button"
                      data-testid={`order-line-seat-decrement-${line.id}`}
                      aria-label="Decrease seat"
                      disabled={isBusy || line.seatNumber == null}
                      onClick={() => onSeatDecrement(line)}
                      className="flex size-6 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-40"
                    >
                      <Minus className="size-3" aria-hidden="true" />
                    </button>
                    <span data-testid={`order-line-seat-${line.id}`} className="min-w-16 text-center text-xs font-semibold tabular-nums text-foreground">
                      {line.seatNumber != null ? `Seat ${line.seatNumber}` : "Unseated"}
                    </span>
                    <button
                      type="button"
                      data-testid={`order-line-seat-increment-${line.id}`}
                      aria-label="Increase seat"
                      disabled={isBusy}
                      onClick={() => onSeatIncrement(line)}
                      className="flex size-6 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-40"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                )}
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
          {firedAt ? "Sent to kitchen" : sendingToKitchen ? "Sending…" : "Send to kitchen"}
        </button>
        {/* Validation blocks forward progress at the point of the violation, per EXPERIENCE.md - never a later, generic submit error. */}
        {!firedAt && unseated > 0 && (
          <p data-testid="send-to-kitchen-blocked" className="mt-2 text-xs text-status-alert">
            {unseated} item{unseated > 1 ? "s" : ""} need{unseated > 1 ? "" : "s"} a seat before sending to the kitchen.{" "}
            {!splitBySeat && (
              <button type="button" onClick={() => setSplitBySeat(true)} className="underline">
                Split by seat
              </button>
            )}
          </p>
        )}
      </footer>
    </aside>
  );
}
