"use client";

// P6 Open & Held Orders (CAP-5). EXPERIENCE.md IA: "reachable from anywhere
// via a persistent nav icon; the outlet-wide alternative to the table map."
// Nested under the real src/app/pos/(shell)/ route group so it gets the
// persistent shift bar, same move story 2 made for /pos/shift (see
// wiki/features/pos-cashier-waiter.md's Reconciliation section).
//
// Reuses story 3's transferOrder action and TransferOwnershipDialog directly
// for "take over someone else's order" (stories.yaml story 6: "call story
// 3's transfer action directly for take-over - this screen is a list view
// over existing Order state, not a new ownership mechanism") - no second
// transfer dialog or endpoint here. "Resume" for the signed-in staff's own
// orders is just a link to the existing /pos/orders/[orderId] route (story
// 3's order-stub destination) - no separate resume endpoint either.
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PosApiError, transferOrder } from "../../api";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { usePosLoad } from "../../use-pos-load";
import { TransferOwnershipDialog } from "../../table-map/transfer-ownership-dialog";
import { formatMinor } from "../shift/shift-state";
import {
  elapsedLabel,
  isOwnOrder,
  OPEN_ORDER_STATUS_LABEL,
  originLabel,
  summarize,
  toOpenOrderEntry,
  type OpenOrderEntry,
  type RawOpenOrder,
} from "./open-orders-state";

export function OpenOrdersScreen({ outletId, currentStaffId }: Readonly<{ outletId: string; currentStaffId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<RawOpenOrder[]>(`outlets/${outletId}/orders`);

  if (loading) return <LoadingShell />;
  if (failed || !data) {
    return <LoadErrorPanel testId="open-orders-error" message="Couldn't load open orders." onRetry={retry} />;
  }
  return <OpenOrdersLoaded orders={data.map(toOpenOrderEntry)} currentStaffId={currentStaffId} onReload={retry} />;
}

function OpenOrdersLoaded({
  orders,
  currentStaffId,
  onReload,
}: Readonly<{ orders: OpenOrderEntry[]; currentStaffId: string; onReload: () => void }>) {
  const router = useRouter();
  const [pendingTransfer, setPendingTransfer] = useState<{ orderId: string; label: string; ownerName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleTransferConfirm(reason: string) {
    if (!pendingTransfer) return;
    setBusy(true);
    transferOrder(pendingTransfer.orderId, reason || undefined)
      .then(() => {
        setPendingTransfer(null);
        router.push(`/pos/orders/${pendingTransfer.orderId}`);
      })
      .catch((error: unknown) => setActionError(error instanceof PosApiError ? error.message : "Couldn't transfer this order."))
      .finally(() => setBusy(false));
  }

  return (
    <div data-testid="open-orders" className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-semibold">Open &amp; held orders</h1>
        <button
          type="button"
          data-testid="open-orders-refresh"
          onClick={onReload}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Refresh
        </button>
      </header>

      {actionError && (
        <div
          role="alert"
          data-testid="open-orders-action-error"
          className="rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm text-status-alert"
        >
          {actionError}{" "}
          <button type="button" className="underline" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    own={isOwnOrder(order, currentStaffId)}
                    busy={busy}
                    onTakeOver={() => {
                      setActionError(null);
                      setPendingTransfer({ orderId: order.id, label: originLabel(order), ownerName: order.ownerStaffId });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <footer data-testid="open-orders-summary" className="text-sm text-muted-foreground">
            {(() => {
              const summary = summarize(orders);
              const count = `${summary.count} open order${summary.count === 1 ? "" : "s"}`;
              return `${count} · ${formatMinor(summary.totalMinor)} in progress`;
            })()}
          </footer>
        </>
      )}

      {pendingTransfer && (
        <TransferOwnershipDialog
          open
          tableLabel={pendingTransfer.label}
          ownerName={pendingTransfer.ownerName}
          busy={busy}
          onCancel={() => setPendingTransfer(null)}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}

function OrderRow({
  order,
  own,
  busy,
  onTakeOver,
}: Readonly<{ order: OpenOrderEntry; own: boolean; busy: boolean; onTakeOver: () => void }>) {
  return (
    <tr data-testid={`open-order-${order.id}`} className="border-b border-border/20 last:border-0">
      <td className="px-4 py-3 font-medium">{originLabel(order)}</td>
      <td className="px-4 py-3">{own ? "You" : order.ownerStaffId}</td>
      <td className="px-4 py-3">{OPEN_ORDER_STATUS_LABEL[order.status]}</td>
      <td className="px-4 py-3 tabular-nums">{elapsedLabel(order.openedAt)}</td>
      <td className="px-4 py-3 tabular-nums">{order.itemCount}</td>
      <td className="px-4 py-3 tabular-nums">{formatMinor(order.totalMinor)}</td>
      <td className="px-4 py-3 text-right">
        {own ? (
          <Button asChild size="sm" data-testid={`open-order-resume-${order.id}`}>
            <Link href={`/pos/orders/${order.id}`}>Resume</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} data-testid={`open-order-take-over-${order.id}`} onClick={onTakeOver}>
            Take over
          </Button>
        )}
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="open-orders-empty"
      className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center"
    >
      <p className="font-headline text-lg font-medium">No open orders</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Every table and counter order in this outlet is settled right now.</p>
    </div>
  );
}

function LoadingShell() {
  return (
    <div data-testid="open-orders-loading" className="flex flex-1 flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
