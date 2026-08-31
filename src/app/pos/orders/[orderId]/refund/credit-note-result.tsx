// Success state for CAP-9: the resulting credit note, never the original
// bill "as edited". refund-view.tsx swaps this in wholesale in place of the
// original-invoice + refund-config two-pane layout once createRefund()
// resolves - there is no code path that re-renders the original BillSummary
// with any refund applied to it (AD-14/CAP-9: a refund is a separate,
// linked record, not a mutation).
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import { REFUND_METHOD_LABEL, type CreditNoteView } from "./refund-state";

export function CreditNoteResult({ creditNote }: Readonly<{ creditNote: CreditNoteView }>) {
  return (
    <section data-testid="credit-note-result" className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
      <p className="font-headline text-xl font-semibold text-status-available">Credit note issued</p>
      <p data-testid="credit-note-number" className="text-sm text-muted-foreground">
        {creditNote.creditNoteNumber} · against Bill #{creditNote.billNumber}
      </p>

      <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-4">
        <ul data-testid="credit-note-lines" className="flex flex-col gap-1.5 text-sm">
          {creditNote.lines.map((line) => (
            <li key={line.id} data-testid={`credit-note-line-${line.id}`} className="flex items-center justify-between">
              <span>
                {line.quantity} × {line.itemName}
                {line.variantName && <span className="text-muted-foreground"> · {line.variantName}</span>}
              </span>
              <span className="tabular-nums">{formatMinor(line.amountMinor, creditNote.currency)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3 text-sm">
          <Row label="Refund subtotal" value={formatMinor(creditNote.subtotalMinor, creditNote.currency)} />
          <Row label="Tax reversal" value={formatMinor(creditNote.taxReversalMinor, creditNote.currency)} />
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <dt className="font-label text-sm font-semibold uppercase tracking-wider text-foreground">Total refunded</dt>
            <dd data-testid="credit-note-total" className="tabular-nums text-lg font-bold text-primary">
              {formatMinor(creditNote.totalMinor, creditNote.currency)}
            </dd>
          </div>
          <Row label="Refunded to" value={REFUND_METHOD_LABEL[creditNote.refundMethod]} />
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">Reason: {creditNote.reasonLabel}</p>
        {creditNote.notes && <p className="text-xs text-muted-foreground">Notes: {creditNote.notes}</p>}
      </div>

      <Button asChild size="sm" variant="outline" data-testid="credit-note-done">
        <Link href="/pos/table-map">Back to table map</Link>
      </Button>
    </section>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
