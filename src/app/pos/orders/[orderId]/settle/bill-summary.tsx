// BillSummary (DESIGN.md's component name, per the pos-core-loop
// design-system.md's component list: "subtotal, tax lines, discount, grand
// total"). Read-only line-item + totals rendering - all math happens
// server-side (the real BillView already carries every computed figure this
// component displays); this component only formats and lays it out,
// mirroring OrderPanel's split between display and state.
//
// RECONCILED (2026-09-02, restiq-web#98): the real `BillView` (bills.dtos.ts,
// read directly) carries no order lines, table label, or currency of its own
// - `lines`/`currency`/`originLabel` are now separate props the caller reads
// off the real Order/Menu instead (`bill-settle-view.tsx`/`counter-view.tsx`/
// `refund-view.tsx`). Tax is one flat figure (`taxMinor`), not a CGST/SGST
// split, and there's no round-off line - neither exists anywhere in the
// schema. `pendingDiscount` renders a discount that's been entered but not
// yet submitted (the real backend only ever applies one inside the single
// finalize call - see bill-state.ts's file header) alongside the bill's own
// `discountMinor` once it actually has one.
//
// CAP-6 QSR counter mode (story 7) additive edit props below:
// `onIncrement`/`onDecrement`/`onRemove`/`busyLineId` are optional and
// default to unset, so story 8's own caller (bill-settle-view.tsx, which
// never passes them) renders exactly as before - a dine-in bill is settled
// after the order's already been sent to the kitchen, so its lines are never
// editable here. The QSR counter screen rings up and settles in one
// continuous screen (SPEC CAP-6), so it needs to keep adjusting quantities
// right up to Finalize - reusing this same line-item table for that (rather
// than a second, parallel line-item component) is the ponytail
// reuse-over-rewrite call.
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import type { OrderLineView } from "../order-taking-state";
import { billTotalMinor, type BillView, type PendingDiscount } from "./bill-state";

export interface BillSummaryProps {
  bill: BillView;
  lines: OrderLineView[];
  currency: string;
  originLabel: string;
  pendingDiscount?: PendingDiscount | null;
  onAddDiscount?: () => void;
  busyLineId?: string | null;
  onIncrement?: (line: OrderLineView) => void;
  onDecrement?: (line: OrderLineView) => void;
  onRemove?: (line: OrderLineView) => void;
}

export function BillSummary({
  bill,
  lines,
  currency,
  originLabel,
  pendingDiscount,
  onAddDiscount,
  busyLineId,
  onIncrement,
  onDecrement,
  onRemove,
}: Readonly<BillSummaryProps>) {
  const editable = Boolean(onIncrement && onDecrement && onRemove);
  const discountMinor = bill.discountMinor ?? pendingDiscount?.amountMinor ?? 0;
  const discountReason = bill.discountReason ?? pendingDiscount?.reason ?? null;
  const totalMinor = billTotalMinor(bill, pendingDiscount?.amountMinor ?? 0);

  return (
    <section data-testid="bill-summary" className="flex w-96 shrink-0 flex-col border-r border-border/60 bg-card">
      <header className="border-b border-border/60 px-4 py-3">
        <p className="font-headline text-sm font-semibold text-foreground">
          Bill {bill.billNumber !== null ? `· #${bill.billNumber} ` : ""}· {originLabel}
        </p>
        <p data-testid="bill-status" className="text-xs text-muted-foreground">
          {bill.status === "finalized" ? "Finalized" : "Draft"}
        </p>
      </header>

      <div data-testid="bill-lines" className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">Amount</th>
              {editable && <th className="pb-2" aria-hidden="true" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const isBusy = busyLineId === line.id;
              return (
                <tr key={line.id} data-testid={`bill-line-${line.id}`} className="align-top">
                  <td className="py-1.5 tabular-nums">
                    {editable ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`bill-line-decrement-${line.id}`}
                          aria-label="Decrease quantity"
                          disabled={isBusy}
                          onClick={() => onDecrement!(line)}
                          className="flex size-6 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-40"
                        >
                          <Minus className="size-3" aria-hidden="true" />
                        </button>
                        <span data-testid={`bill-line-qty-${line.id}`} className="w-4 text-center tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          data-testid={`bill-line-increment-${line.id}`}
                          aria-label="Increase quantity"
                          disabled={isBusy}
                          onClick={() => onIncrement!(line)}
                          className="flex size-6 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:opacity-40"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      line.quantity
                    )}
                  </td>
                  <td className="py-1.5">
                    <p className="font-medium text-foreground">
                      {line.itemName}
                      {line.variantName && <span className="text-muted-foreground"> · {line.variantName}</span>}
                    </p>
                    {line.modifiers.length > 0 && (
                      <p className="text-xs text-muted-foreground">{line.modifiers.map((modifier) => modifier.name).join(", ")}</p>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatMinor(line.lineTotalMinor, currency)}</td>
                  {editable && (
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        data-testid={`bill-line-remove-${line.id}`}
                        aria-label="Remove line"
                        disabled={isBusy}
                        onClick={() => onRemove!(line)}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-status-alert disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-border/60 p-4">
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="Subtotal" value={formatMinor(bill.subtotalMinor, currency)} />
          {discountMinor > 0 && (
            <Row
              label={`Discount${discountReason ? ` — ${discountReason}` : ""}`}
              value={`-${formatMinor(discountMinor, currency)}`}
              tone="available"
            />
          )}
          <Row label="Tax" value={formatMinor(bill.taxMinor, currency)} />
          <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
            <span className="font-label text-sm font-semibold uppercase tracking-wider text-foreground">Total</span>
            <span data-testid="bill-grand-total" className="tabular-nums text-lg font-bold text-primary">
              {formatMinor(totalMinor, currency)}
            </span>
          </div>
        </dl>

        {bill.status === "open" && onAddDiscount && (
          <button
            type="button"
            data-testid="bill-add-discount"
            onClick={onAddDiscount}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            {pendingDiscount ? "Change discount" : "Add discount"}
          </button>
        )}
      </footer>
    </section>
  );
}

function Row({ label, value, tone }: Readonly<{ label: string; value: string; tone?: "available" }>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={`text-muted-foreground ${tone === "available" ? "text-status-available" : ""}`}>{label}</dt>
      <dd className={`tabular-nums ${tone === "available" ? "text-status-available" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}
