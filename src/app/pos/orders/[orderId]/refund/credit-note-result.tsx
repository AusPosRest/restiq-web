// Success state for CAP-9: the resulting credit note, never the original
// bill "as edited". refund-view.tsx swaps this in wholesale in place of the
// original-invoice + refund-config two-pane layout once createRefund()
// resolves - there is no code path that re-renders the original BillSummary
// with any refund applied to it (AD-14/CAP-9: a refund is a separate,
// linked record, not a mutation).
//
// RECONCILED (2026-09-02, restiq-web#98): the real `CreditNoteView`
// (bills.dtos.ts, read directly) has no `creditNoteNumber`/`billNumber` (no
// numbering scheme exists for credit notes), no `currency` of its own, and
// each line names an `orderLineId` rather than carrying its own item/variant
// name - resolved here against the original order's lines (`lines` prop,
// same "raw id, resolved where we can, never fabricated" posture
// order-taking-state.ts already established). `refundMethod`/`reasonLabel`/
// `notes` are gone too - the real DTO has one plain `reason` string.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import type { OrderLineView } from "../order-taking-state";
import type { CreditNoteView } from "./refund-state";

export function CreditNoteResult({
  creditNote,
  lines,
  currency,
}: Readonly<{ creditNote: CreditNoteView; lines: OrderLineView[]; currency: string }>) {
  const linesById = new Map(lines.map((line) => [line.id, line]));

  return (
    <section data-testid="credit-note-result" className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
      <p className="font-headline text-xl font-semibold text-status-available">Credit note issued</p>
      <p data-testid="credit-note-number" className="text-sm text-muted-foreground">
        Credit note {creditNote.id} · against bill {creditNote.originalBillId}
      </p>

      <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-4">
        <ul data-testid="credit-note-lines" className="flex flex-col gap-1.5 text-sm">
          {creditNote.lines.map((line) => {
            const original = linesById.get(line.orderLineId);
            return (
              <li key={line.id} data-testid={`credit-note-line-${line.id}`} className="flex items-center justify-between">
                <span>
                  {line.quantity} × {original?.itemName ?? line.orderLineId}
                  {original?.variantName && <span className="text-muted-foreground"> · {original.variantName}</span>}
                </span>
                <span className="tabular-nums">{formatMinor(line.amountMinor, currency)}</span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3 text-sm">
          <Row label="Refund subtotal" value={formatMinor(creditNote.subtotalMinor, currency)} />
          <Row label="Tax reversal" value={formatMinor(creditNote.taxMinor, currency)} />
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <dt className="font-label text-sm font-semibold uppercase tracking-wider text-foreground">Total refunded</dt>
            <dd data-testid="credit-note-total" className="tabular-nums text-lg font-bold text-primary">
              {formatMinor(creditNote.totalMinor, currency)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">Reason: {creditNote.reason}</p>
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
