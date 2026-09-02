"use client";

// P8 Bill & Settle (CAP-7, story 8). Reached from order-taking-view.tsx's
// "Settle" link.
//
// RECONCILED (2026-09-02, restiq-web#98) against the real, merged
// restiq-backend `src/pos/bills/*` (see bill-state.ts's file header for the
// full reasoning). What changed about this screen specifically:
//  - the Bill is created-or-fetched (`fetchOrCreateBill`), not GET-and-render
//    via usePosLoad - there is no GET keyed by orderId.
//  - a Bill carries no order lines/currency of its own, so this screen also
//    loads the real Order (for its lines) and the Menu (for currency + item
//    names, same as order-taking-view.tsx) and passes both to BillSummary.
//  - discount and every tender accumulate locally (`pendingDiscount`/
//    `pendingTenders`) and are only ever sent together, in the one Finalize
//    call - AD-14's "no mutation UI after finalization" rule still holds,
//    it's just that "mutation" now means "local state" until that one call.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchOrCreateBill,
  finalizeBill,
  PosApiError,
  type BillTenderMethod,
  type PendingDiscount,
  type PendingTender,
} from "../../../api";
import { LoadErrorPanel, Skeleton } from "../../../data-states";
import { usePosLoad } from "../../../use-pos-load";
import { orderOriginLabel, toOrderView, type PosMenuView, type RawOrder } from "../order-taking-state";
import { BillSummary } from "./bill-summary";
import { TenderKeypad } from "./tender-keypad";
import { DiscountDialog } from "./discount-dialog";
import { billTotalMinor, canFinalizeBill, isBillReadOnly, pendingTenderedMinor, type BillView } from "./bill-state";

interface BillLanded {
  attempt: number;
  bill: BillView | null;
  failed: boolean;
}

/** Same "landed keyed by attempt" shape use-pos-load.ts's hook uses - `fetchOrCreateBill` is a POST, not a GET, so it can't just reuse that hook directly, but retry/loading derive the same way (no synchronous setState in the effect body). */
function useBill(orderId: string) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<BillLanded | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrCreateBill(orderId)
      .then((value) => {
        if (!cancelled) setLanded({ attempt, bill: value, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, bill: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  const current = landed !== null && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    bill: current?.bill ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function BillSettleView({ orderId }: Readonly<{ orderId: string }>) {
  const menuLoad = usePosLoad<PosMenuView>("menu");
  const orderLoad = usePosLoad<RawOrder>(`orders/${orderId}`);
  const billLoad = useBill(orderId);

  if (menuLoad.loading || orderLoad.loading || billLoad.loading) return <LoadingShell />;
  if (billLoad.failed || !billLoad.bill) {
    return <LoadErrorPanel testId="bill-settle-error" message="Couldn't load this bill." onRetry={billLoad.retry} />;
  }
  if (menuLoad.failed || !menuLoad.data || orderLoad.failed || !orderLoad.data) {
    return (
      <LoadErrorPanel
        testId="bill-settle-error"
        message="Couldn't load this bill."
        onRetry={() => {
          menuLoad.retry();
          orderLoad.retry();
        }}
      />
    );
  }
  return <BillSettleLoaded orderId={orderId} initialBill={billLoad.bill} menu={menuLoad.data} rawOrder={orderLoad.data} />;
}

function BillSettleLoaded({
  orderId,
  initialBill,
  menu,
  rawOrder,
}: Readonly<{ orderId: string; initialBill: BillView; menu: PosMenuView; rawOrder: RawOrder }>) {
  const [bill, setBill] = useState(initialBill);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<PendingDiscount | null>(null);
  const [pendingTenders, setPendingTenders] = useState<PendingTender[]>([]);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const order = toOrderView(rawOrder, menu);
  const readOnly = isBillReadOnly(bill);
  const totalMinor = billTotalMinor(bill, pendingDiscount?.amountMinor ?? 0);
  const remainingMinor = Math.max(0, totalMinor - pendingTenderedMinor(pendingTenders));

  function handleAddTender(method: BillTenderMethod, amountMinor: number) {
    setPendingTenders((current) => [...current, { method, amountMinor }]);
  }

  function handleRemoveTender(index: number) {
    setPendingTenders((current) => current.filter((_, i) => i !== index));
  }

  function handleFinalize() {
    setFinalizeBusy(true);
    setFinalizeError(null);
    finalizeBill(bill.id, {
      discountMinor: pendingDiscount?.amountMinor,
      discountReason: pendingDiscount?.reason,
      managerPin: pendingDiscount?.managerPin,
      tenders: pendingTenders,
    })
      .then(setBill)
      .catch((error: unknown) => setFinalizeError(errorMessage(error, "Couldn't finalise this bill.")))
      .finally(() => setFinalizeBusy(false));
  }

  return (
    <div data-testid="bill-settle-view" className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border/60 px-6 py-3">
        <Link href={`/pos/orders/${orderId}`} data-testid="back-to-order" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to order
        </Link>
        <p className="font-headline text-lg font-bold text-primary">RESTIQ POS</p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <BillSummary
          bill={bill}
          lines={order.lines}
          currency={menu.currency}
          originLabel={orderOriginLabel(order)}
          pendingDiscount={pendingDiscount}
          onAddDiscount={() => setDiscountDialogOpen(true)}
        />

        {readOnly ? (
          <section data-testid="bill-finalised-panel" className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="font-headline text-xl font-semibold text-status-available">Bill finalised</p>
            <p className="text-sm text-muted-foreground">
              {bill.tenders.length} tender{bill.tenders.length === 1 ? "" : "s"} captured · no further changes are possible.
            </p>
            <div className="mt-2 flex gap-2">
              <Button asChild size="sm" variant="outline" data-testid="bill-finalised-back">
                <Link href="/pos/table-map">Back to table map</Link>
              </Button>
              {/* CAP-9 entry point (story 10): the only way into P10 Refund &
                  Adjustments is from here, once a bill is finalised and thus
                  eligible for refund - see refund-view.tsx's file header.
                  `billId` rides along in the query string because the real
                  refund endpoint targets the Bill, not the Order, and this
                  screen is the one place that already has it in hand. */}
              <Button asChild size="sm" variant="outline" data-testid="bill-finalised-refund">
                <Link href={`/pos/orders/${orderId}/refund?billId=${bill.id}`}>Refund…</Link>
              </Button>
            </div>
          </section>
        ) : (
          <div className="flex flex-1 flex-col">
            <TenderKeypad
              currency={menu.currency}
              remainingMinor={remainingMinor}
              tenders={pendingTenders}
              onAddTender={handleAddTender}
              onRemoveTender={handleRemoveTender}
            />
            <footer className="border-t border-border/60 p-4">
              {finalizeError && (
                <p role="alert" data-testid="finalize-error" className="mb-2 text-sm text-status-alert">
                  {finalizeError}
                </p>
              )}
              <Button
                size="lg"
                className="w-full"
                data-testid="finalize-bill"
                disabled={!canFinalizeBill(bill, totalMinor, pendingTenders) || finalizeBusy}
                onClick={handleFinalize}
              >
                {finalizeBusy ? "Finalising…" : "Finalise"}
              </Button>
            </footer>
          </div>
        )}
      </div>

      <DiscountDialog
        open={discountDialogOpen}
        subtotalMinor={bill.subtotalMinor}
        onCancel={() => setDiscountDialogOpen(false)}
        onApply={setPendingDiscount}
      />
    </div>
  );
}

function LoadingShell() {
  return (
    <div data-testid="bill-settle-loading" className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof PosApiError ? error.message : fallback;
}
