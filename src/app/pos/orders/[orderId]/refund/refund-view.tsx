"use client";

// P10 Refund & Adjustments (CAP-9, story 10). Reached from the finalised
// bill-settle-view.tsx's "Bill finalised" panel (story 8) via its "Refund…"
// entry point.
//
// RECONCILED (2026-09-02, restiq-web#98) against the real, merged
// restiq-backend `src/pos/bills/*` (see refund-state.ts's file header for
// the full reasoning). What changed about this screen specifically:
//  - it now reads a `billId` (from the URL, see page.tsx) rather than
//    GET-ing `orders/:id/bill` - that route never existed, the real one is
//    `GET bills/:id`.
//  - the "original invoice" line items come from the real Order (loaded
//    separately, same as bill-settle-view.tsx), not from the Bill itself -
//    a Bill carries no lines of its own.
//
// Still reuses two real, already-merged pieces rather than rebuilding
// either: BillSummary (story 8, settle/bill-summary.tsx) renders the
// original, finalized bill's line items + totals read-only (no discount
// affordance shows because `bill.status` is already "finalized" -
// BillSummary itself already gates that); ManagerPinDialog (story 9,
// components/manager-pin-dialog.tsx) gates the actual refund submission -
// see refund-config-panel.tsx.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBill } from "../../../api";
import { LoadErrorPanel, Skeleton } from "../../../data-states";
import { usePosLoad } from "../../../use-pos-load";
import { orderOriginLabel, toOrderView, type PosMenuView, type RawOrder } from "../order-taking-state";
import { BillSummary } from "../settle/bill-summary";
import type { BillView } from "../settle/bill-state";
import { canRefundBill, type CreditNoteView } from "./refund-state";
import { RefundConfigPanel } from "./refund-config-panel";
import { CreditNoteResult } from "./credit-note-result";

interface BillLanded {
  attempt: number;
  bill: BillView | null;
  failed: boolean;
}

/** Same "landed keyed by attempt" shape use-pos-load.ts's hook uses, adapted for a `billId` that can be `null` (nothing to fetch yet - see the no-bill-id branch below). */
function useBill(billId: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<BillLanded | null>(null);

  useEffect(() => {
    if (!billId) return;
    let cancelled = false;
    getBill(billId)
      .then((value) => {
        if (!cancelled) setLanded({ attempt, bill: value, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, bill: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [billId, attempt]);

  const current = landed !== null && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    bill: current?.bill ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function RefundView({ orderId, billId }: Readonly<{ orderId: string; billId: string | null }>) {
  const menuLoad = usePosLoad<PosMenuView>("menu");
  const orderLoad = usePosLoad<RawOrder>(`orders/${orderId}`);
  const billLoad = useBill(billId);

  if (!billId) {
    return (
      <section data-testid="refund-no-bill" className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <p>Open this order&apos;s Settle screen first, then use its Refund… link.</p>
        <Link href={`/pos/orders/${orderId}/settle`} data-testid="refund-back-to-settle" className="text-primary underline-offset-4 hover:underline">
          Go to Settle
        </Link>
      </section>
    );
  }

  if (menuLoad.loading || orderLoad.loading || billLoad.loading) return <LoadingShell />;
  if (billLoad.failed || !billLoad.bill || menuLoad.failed || !menuLoad.data || orderLoad.failed || !orderLoad.data) {
    return (
      <LoadErrorPanel
        testId="refund-error"
        message="Couldn't load this bill."
        onRetry={() => {
          billLoad.retry();
          menuLoad.retry();
          orderLoad.retry();
        }}
      />
    );
  }
  return <RefundLoaded orderId={orderId} billId={billId} bill={billLoad.bill} menu={menuLoad.data} rawOrder={orderLoad.data} />;
}

function RefundLoaded({
  orderId,
  billId,
  bill,
  menu,
  rawOrder,
}: Readonly<{ orderId: string; billId: string; bill: BillView; menu: PosMenuView; rawOrder: RawOrder }>) {
  // AD-14/CAP-9: the original bill is never mutated by a refund - this state
  // only ever swaps to the resulting CreditNoteView, it never rewrites `bill`.
  const [creditNote, setCreditNote] = useState<CreditNoteView | null>(null);
  const order = toOrderView(rawOrder, menu);

  return (
    <div data-testid="refund-view" className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border/60 px-6 py-3">
        <Link href={`/pos/orders/${orderId}/settle`} data-testid="back-to-bill" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to bill
        </Link>
        <p className="font-headline text-lg font-bold text-primary">RESTIQ POS · Refund mode</p>
      </header>

      {creditNote ? (
        <CreditNoteResult creditNote={creditNote} lines={order.lines} currency={menu.currency} />
      ) : !canRefundBill(bill) ? (
        <section data-testid="refund-not-eligible" className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Only a finalized bill can be refunded.
        </section>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <BillSummary bill={bill} lines={order.lines} currency={menu.currency} originLabel={orderOriginLabel(order)} />
          <RefundConfigPanel billId={billId} lines={order.lines} currency={menu.currency} onRefunded={setCreditNote} />
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
