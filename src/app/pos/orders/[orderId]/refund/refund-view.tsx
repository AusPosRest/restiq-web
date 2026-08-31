"use client";

// P10 Refund & Adjustments (CAP-9, story 10). Reached from the finalised
// bill-settle-view.tsx's "Bill finalised" panel (story 8) via a new
// "Refund…" entry point added there. Same five-state GET-and-render pattern
// as every other /pos screen (usePosLoad) - and the same GET
// (`orders/:id/bill`) story 8 already built, since the "original invoice"
// this screen shows is exactly that finalised BillView, read-only.
//
// Reuses two real, already-merged pieces rather than rebuilding either:
//   - BillSummary (story 8, settle/bill-summary.tsx) renders the original,
//     finalised bill's line items + totals exactly as the settle screen
//     does. No discount affordance shows because bill.status is already
//     "finalised" - BillSummary itself already gates that, nothing new to
//     wire here.
//   - ManagerPinDialog (story 9, components/manager-pin-dialog.tsx) gates
//     the actual refund submission - see refund-config-panel.tsx.
// See refund-state.ts's file header for the self-authored-contract
// reasoning (restiq-backend#63 has no branch yet).
import Link from "next/link";
import { useState } from "react";
import { LoadErrorPanel, Skeleton } from "../../../data-states";
import { usePosLoad } from "../../../use-pos-load";
import { BillSummary } from "../settle/bill-summary";
import type { BillView } from "../settle/bill-state";
import { canRefundBill, type CreditNoteView } from "./refund-state";
import { RefundConfigPanel } from "./refund-config-panel";
import { CreditNoteResult } from "./credit-note-result";

export function RefundView({ orderId }: Readonly<{ orderId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<BillView>(`orders/${orderId}/bill`);

  if (loading) return <LoadingShell />;
  if (failed || !data) {
    return <LoadErrorPanel testId="refund-error" message="Couldn't load this bill." onRetry={retry} />;
  }
  return <RefundLoaded orderId={orderId} bill={data} />;
}

function RefundLoaded({ orderId, bill }: Readonly<{ orderId: string; bill: BillView }>) {
  // AD-14/CAP-9: the original bill is never mutated by a refund - this state
  // only ever swaps to the resulting CreditNoteView, it never rewrites `bill`.
  const [creditNote, setCreditNote] = useState<CreditNoteView | null>(null);

  return (
    <div data-testid="refund-view" className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border/60 px-6 py-3">
        <Link href={`/pos/orders/${orderId}/settle`} data-testid="back-to-bill" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to bill
        </Link>
        <p className="font-headline text-lg font-bold text-primary">RESTIQ POS · Refund mode</p>
      </header>

      {creditNote ? (
        <CreditNoteResult creditNote={creditNote} />
      ) : !canRefundBill(bill) ? (
        <section data-testid="refund-not-eligible" className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Only a finalised bill can be refunded.
        </section>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <BillSummary bill={bill} onAddDiscount={() => {}} />
          <RefundConfigPanel orderId={orderId} bill={bill} onRefunded={setCreditNote} />
        </div>
      )}
    </div>
  );
}

function LoadingShell() {
  return (
    <div data-testid="refund-loading" className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
