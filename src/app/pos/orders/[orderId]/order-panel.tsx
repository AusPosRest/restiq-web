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
import { canSendToKitchen, computeOrderTotalMinor, formatPriceMinor, orderOriginLabel, staffLabel, unsentLineCount, type OrderLineView, type OrderView } from "./order-taking-state";

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
  /** restiq-backend#210 (CU-15): a line the kitchen already has is voided with a manager PIN instead of removed. */
  onVoid: (line: OrderLineView) => void;
  /** Absent while someone else owns the order - every change control is hidden then (SE-22). */
  editable: boolean;
  /** Shown only while the order has no lines (PE-16/CU-27). */
  onDiscard: () => void;
  discarding: boolean;
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
  onVoid,
  editable,
  onDiscard,
  discarding,
  sendingToKitchen,
  onSendToKitchen,
}: Readonly<OrderPanelProps>) {
  const totalMinor = computeOrderTotalMinor(lines);
  const canSend = editable && canSendToKitchen({ lines, status });
  // issue #306: a closed (paid) order is a record - no quantity or remove controls.
  const closed = status === "closed";
  const unsent = unsentLineCount({ lines });
  const sendButtonLabel = closed
    ? "Closed"
    : sendingToKitchen
      ? "Sending…"
      : unsent === 0
        ? lines.length === 0
          ? "Send to kitchen"
          : "Sent to kitchen"
        : status === "sent"
          ? `Send ${unsent} new item${unsent === 1 ? "" : "s"} to kitchen`
          : "Send to kitchen";

  return (
    <aside data-testid="order-panel" className="flex w-full shrink-0 flex-col border-t border-border/60 bg-card lg:w-80 lg:border-l lg:border-t-0">
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
            // CU-15: an unsent line can be changed freely; a sent one only voided. Controls that can't work are not shown.
            const canChange = editable && !closed && !line.sentToKitchen;
            const canVoid = editable && !closed && line.sentToKitchen;
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
                    {line.components.length > 0 && (
                      <ul data-testid={`order-line-components-${line.id}`} className="mt-0.5 text-xs text-muted-foreground">
                        {line.components.map((component, i) => (
                          <li key={i}>{component}</li>
                        ))}
                      </ul>
                    )}
                    {line.note && (
                      <p data-testid={`order-line-note-${line.id}`} className="text-xs italic text-foreground/80">
                        Note: {line.note}
                      </p>
                    )}
                    <p data-testid={`order-line-added-by-${line.id}`} className="text-[11px] text-muted-foreground/80">
                      Added by {staffLabel(line.addedByStaffId, line.addedByStaffName, currentStaffId)}
                    </p>
                    {!closed && (
                      <p
                        data-testid={`order-line-kitchen-state-${line.id}`}
                        className={`text-[11px] font-semibold uppercase tracking-wider ${line.sentToKitchen ? "text-muted-foreground" : "text-primary"}`}
                      >
                        {line.sentToKitchen ? "In kitchen" : status === "sent" ? "New - not sent yet" : "Not sent yet"}
                      </p>
                    )}
                  </div>
                  <p className="tabular-nums text-sm font-semibold text-foreground">{formatPriceMinor(line.lineTotalMinor, currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* A combo is changed by removing it and adding it again (restiq-backend#160). */}
                  {line.comboId || !canChange ? (
                    <span data-testid={`order-line-qty-${line.id}`} className="text-sm font-semibold tabular-nums">
                      {line.quantity}×
                    </span>
                  ) : (
                    <>
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
                    </>
                  )}
                  {canChange && (
                    <button
                      type="button"
                      data-testid={`order-line-remove-${line.id}`}
                      aria-label={`Remove ${line.itemName}`}
                      disabled={isBusy}
                      onClick={() => onRemove(line)}
                      className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-status-alert disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                  {canVoid && (
                    <button
                      type="button"
                      data-testid={`order-line-void-${line.id}`}
                      disabled={isBusy}
                      onClick={() => onVoid(line)}
                      className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-status-alert disabled:opacity-40"
                    >
                      Void…
                    </button>
                  )}
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
          <>
            <Button size="lg" className="mt-3 w-full" data-testid="go-to-settle" disabled>
              Settle
            </Button>
            {editable && !closed && (
              <Button size="lg" variant="outline" className="mt-2 w-full" data-testid="discard-order" disabled={discarding} onClick={onDiscard}>
                {discarding ? "Discarding…" : "Discard empty order"}
              </Button>
            )}
          </>
        ) : (
          <Button asChild size="lg" variant={closed ? "outline" : "default"} className="mt-3 w-full" data-testid="go-to-settle">
            <Link href={`/pos/orders/${orderId}/settle`}>{closed ? "View bill" : "Settle"}</Link>
          </Button>
        )}
      </footer>
    </aside>
  );
}
