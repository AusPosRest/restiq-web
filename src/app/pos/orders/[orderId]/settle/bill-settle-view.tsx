"use client";

// P8 Bill & Settle (CAP-7, story 8) - see bill-state.ts's file header for the
// full self-authored-contract reasoning (restiq-backend#59 has no branch
// yet) and the design-basis note (no SPEC.md/DESIGN.md/EXPERIENCE.md exist
// for this capability in restiq-design; built from the P8 mock and
// design-system.md alone). Reached from order-taking-view.tsx's new
// "Settle" link. Same five-state GET-and-render pattern as every other /pos
// screen (usePosLoad), with every mutation (discount, tender, finalize)
// replacing the whole BillView from the response rather than an optimistic
// local patch - matches order-taking-view.tsx's line-mutation pattern.
//
// AD-14 (insert-only past finalisation): once `bill.status === "finalised"`,
// this view renders BillSummaryReadOnly instead of any of the mutation UI
// (discount button, TenderKeypad, Finalize) - there is no code path back to
// the mutable view for a finalised bill, matching the task's "after
// finalising, no edit UI at all" requirement.
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addBillTender, applyBillDiscount, finalizeBill, PosApiError, type BillTenderMethod } from "../../../api";
import { LoadErrorPanel, Skeleton } from "../../../data-states";
import { usePosLoad } from "../../../use-pos-load";
import type { ManagerApprovalResult } from "../../../components/manager-pin-dialog";
import { BillSummary } from "./bill-summary";
import { TenderKeypad } from "./tender-keypad";
import { DiscountDialog } from "./discount-dialog";
import { canFinalizeBill, isBillReadOnly, type ApplyDiscountInput, type BillView } from "./bill-state";

export function BillSettleView({ orderId }: Readonly<{ orderId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<BillView>(`orders/${orderId}/bill`);

  if (loading) return <LoadingShell />;
  if (failed || !data) {
    return <LoadErrorPanel testId="bill-settle-error" message="Couldn't load this bill." onRetry={retry} />;
  }
  return <BillSettleLoaded orderId={orderId} initialBill={data} />;
}

function BillSettleLoaded({ orderId, initialBill }: Readonly<{ orderId: string; initialBill: BillView }>) {
  const [bill, setBill] = useState(initialBill);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [tenderBusy, setTenderBusy] = useState(false);
  const [tenderError, setTenderError] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const readOnly = isBillReadOnly(bill);

  async function handleApplyDiscount(input: ApplyDiscountInput): Promise<ManagerApprovalResult> {
    try {
      const updated = await applyBillDiscount(orderId, input);
      setBill(updated);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "Couldn't apply the discount.") };
    }
  }

  function handleAddTender(method: BillTenderMethod, amountMinor: number) {
    setTenderBusy(true);
    setTenderError(null);
    addBillTender(orderId, { method, amountMinor })
      .then(setBill)
      .catch((error: unknown) => setTenderError(errorMessage(error, "Couldn't add that tender.")))
      .finally(() => setTenderBusy(false));
  }

  function handleFinalize() {
    setFinalizeBusy(true);
    setFinalizeError(null);
    finalizeBill(orderId)
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
        <BillSummary bill={bill} onAddDiscount={() => setDiscountDialogOpen(true)} />

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
                  eligible for refund - see refund-view.tsx's file header. */}
              <Button asChild size="sm" variant="outline" data-testid="bill-finalised-refund">
                <Link href={`/pos/orders/${orderId}/refund`}>Refund…</Link>
              </Button>
            </div>
          </section>
        ) : (
          <div className="flex flex-1 flex-col">
            <TenderKeypad
              currency={bill.currency}
              remainingMinor={bill.remainingMinor}
              tenders={bill.tenders}
              busy={tenderBusy}
              error={tenderError}
              onAddTender={handleAddTender}
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
                disabled={!canFinalizeBill(bill) || finalizeBusy}
                onClick={handleFinalize}
              >
                {finalizeBusy ? "Finalising…" : "Finalise"}
              </Button>
            </footer>
          </div>
        )}
      </div>

      <DiscountDialog open={discountDialogOpen} onCancel={() => setDiscountDialogOpen(false)} onApply={handleApplyDiscount} />
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
