// BillSummary (DESIGN.md's component name, per the pos-core-loop
// design-system.md's component list: "subtotal, tax lines, discount, grand
// total"). Read-only line-item + totals rendering - all math happens
// server-side (the self-authored BillView already carries every computed
// figure); this component only formats and lays it out, mirroring
// OrderPanel's split between display and state.
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
// reuse-over-rewrite call: BillSummary already renders exactly the line/qty/
// amount table a counter order needs, it just needed the steppers wired
// in as an opt-in.
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import type { OrderLineView } from "../order-taking-state";
import type { BillView } from "./bill-state";

export interface BillSummaryProps {
  bill: BillView;
  onAddDiscount?: () => void;
  busyLineId?: string | null;
  onIncrement?: (line: OrderLineView) => void;
  onDecrement?: (line: OrderLineView) => void;
  onRemove?: (line: OrderLineView) => void;
}

export function BillSummary({ bill, onAddDiscount, busyLineId, onIncrement, onDecrement, onRemove }: Readonly<BillSummaryProps>) {
  const editable = Boolean(onIncrement && onDecrement && onRemove);
  return (
    <section data-testid="bill-summary" className="flex w-96 shrink-0 flex-col border-r border-border/60 bg-card">
      <header className="border-b border-border/60 px-4 py-3">
        <p className="font-headline text-sm font-semibold text-foreground">
          Bill · Order #{bill.billNumber} · {bill.tableLabel}
        </p>
        <p data-testid="bill-status" className="text-xs text-muted-foreground">
          {bill.status === "finalised" ? "Finalised" : "Draft"}
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
            {bill.lines.map((line) => {
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
                  <td className="py-1.5 text-right tabular-nums">{formatMinor(line.lineTotalMinor, bill.currency)}</td>
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
          <Row label="Subtotal" value={formatMinor(bill.subtotalMinor, bill.currency)} />
          {bill.discount && (
            <Row
              label={`Discount ${bill.discount.percentValue}% — ${bill.discount.reasonLabel}${
                bill.discount.managerApproved ? " (Manager approved)" : ""
              }`}
              value={`-${formatMinor(bill.discount.amountMinor, bill.currency)}`}
              tone="available"
            />
          )}
          {bill.taxLines.map((tax) => (
            <Row key={tax.label} label={`${tax.label} ${tax.ratePercent}%`} value={formatMinor(tax.amountMinor, bill.currency)} />
          ))}
          {bill.roundOffMinor !== 0 && <Row label="Round-off" value={formatMinor(bill.roundOffMinor, bill.currency)} />}
          <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
            <span className="font-label text-sm font-semibold uppercase tracking-wider text-foreground">Grand Total</span>
            <span data-testid="bill-grand-total" className="tabular-nums text-lg font-bold text-primary">
              {formatMinor(bill.grandTotalMinor, bill.currency)}
            </span>
          </div>
        </dl>

        {bill.status === "draft" && onAddDiscount && (
          <button
            type="button"
            data-testid="bill-add-discount"
            onClick={onAddDiscount}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            {bill.discount ? "Change discount" : "Add discount"}
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
