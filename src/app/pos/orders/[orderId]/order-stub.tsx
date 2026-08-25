"use client";

// Placeholder order view this story (CAP-2, #40) hands off to story 4
// ("Order taking with modifiers, variants, combos", CAP-3, screens P3/P4).
// CAP-2's own scope stops at proving the ownership/transfer mechanics reach a
// real order end-to-end (SPEC.md: "this story doesn't yet have full
// order-taking behind it") - this route (/pos/orders/[orderId]) is exactly
// where story 4 should build the real P3 order-taking screen. Do not build a
// second order route elsewhere; extend OrderStubView/fetchOrder's contract
// here instead of duplicating it.
import Link from "next/link";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { usePosLoad } from "../../use-pos-load";
import type { OrderStubView } from "../../api";

export function OrderStub({ orderId }: Readonly<{ orderId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<OrderStubView>(`orders/${orderId}`);

  if (loading) return <LoadingShell />;
  if (failed || !data) {
    return <LoadErrorPanel testId="order-stub-error" message="Couldn't load this order." onRetry={retry} />;
  }

  return (
    <div data-testid="order-stub-view" className="flex flex-1 flex-col gap-4 p-6">
      <Link href="/pos/table-map" data-testid="back-to-table-map" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Back to table map
      </Link>
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="font-headline text-lg font-semibold">Table {data.tableLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Owned by <span className="font-semibold text-foreground">{data.ownerStaffName}</span>
        </p>
        <p className="mt-4 rounded-md border border-dashed border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground">
          Order taking (modifiers, variants, combos) isn&apos;t built yet - this is CAP-3&apos;s screen (P3/P4), coming in the
          next story.
        </p>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
