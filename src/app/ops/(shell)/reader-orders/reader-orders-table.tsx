"use client";

// Reader orders (restiq-web#429): one table for the fleet-wide Reader orders page and the tenant
// Payments tab. Every move is audited, so it goes through the reason dialog; Mark shipped also
// takes the tracking number.
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReaderOrderView } from "@/lib/card-readers";
import { ORDER_STATUS_LABEL, shippingSummary } from "@/lib/card-readers";
import { formatDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { opsApi, OpsApiError } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { StatusBadge } from "../status-badge";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";
import { ACTION_DESCRIPTION, ACTION_LABEL, actionsFor, orderPatch, type OrderAction } from "./reader-orders-state";

const TH = "font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function ReaderOrdersTable({ path, showTenant, emptyText }: Readonly<{ path: string; showTenant: boolean; emptyText: string }>) {
  const toast = useToast();
  const { loading, failed, data, retry } = useOpsLoad<{ orders: ReaderOrderView[] }>(path);
  const [pending, setPending] = useState<{ order: ReaderOrderView; action: OrderAction } | null>(null);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);

  function open(order: ReaderOrderView, action: OrderAction) {
    setTracking(order.trackingRef ?? "");
    setPending({ order, action });
  }

  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      await opsApi(`reader-orders/${pending.order.id}`, { method: "PATCH", body: JSON.stringify(orderPatch(pending.action, reason, tracking)) });
      toast({ kind: "success", message: `${pending.order.tenantName}'s order is now ${ORDER_STATUS_LABEL[pending.action].toLowerCase()}.` });
      setPending(null);
      retry();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The order could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <LoadErrorPanel message="Reader orders could not be loaded." onRetry={retry} testId="reader-orders-error" />;
  if (loading || !data) return <Skeleton className="h-32 w-full" data-testid="reader-orders-loading" />;
  if (data.orders.length === 0) {
    return (
      <p data-testid="reader-orders-empty" className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-sm" data-testid="reader-orders-table">
          <thead>
            <tr className="h-11 border-b border-border/40">
              {showTenant && <th className={TH}>Restaurant</th>}
              <th className={TH}>Order</th>
              <th className={TH}>Total</th>
              <th className={TH}>Ship to</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order.id} data-testid={`reader-order-${order.id}`} className="border-b border-border/20 align-top last:border-b-0">
                {showTenant && (
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/tenants/${order.tenantId}?tab=payments`}
                      data-testid={`reader-order-tenant-${order.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {order.tenantName}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className="font-medium">
                    {order.displayName} × {order.quantity}
                  </span>
                  <span className="block text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(Number(order.totalMinor), order.currency)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {shippingSummary(order.shipping)}
                  <span className="block text-xs">For {order.outletName}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} testId={`reader-order-status-${order.id}`} />
                  {order.failureMessage && <span className="mt-1 block text-xs text-status-critical">{order.failureMessage}</span>}
                  {order.trackingRef && (
                    <span className="mt-1 block text-xs text-muted-foreground" data-testid={`reader-order-tracking-${order.id}`}>
                      Tracking {order.trackingRef}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {actionsFor(order.status).map((action) => (
                      <Button
                        key={action}
                        size="sm"
                        variant="secondary"
                        data-testid={`reader-order-${action}-${order.id}`}
                        className={action === "cancelled" ? "text-status-critical hover:bg-status-critical/10" : undefined}
                        onClick={() => open(order, action)}
                      >
                        {ACTION_LABEL[action]}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmReasonDialog
        open={pending !== null}
        title={pending ? `${ACTION_LABEL[pending.action]}: ${pending.order.displayName} × ${pending.order.quantity}?` : ""}
        destructive={pending?.action === "cancelled"}
        description={
          pending && (
            <>
              {ACTION_DESCRIPTION[pending.action]}
              {pending.action === "shipped" && (
                <label className="mt-3 block">
                  <span className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking number (optional)</span>
                  <input
                    data-testid="reader-order-tracking-input"
                    value={tracking}
                    maxLength={100}
                    onChange={(event) => setTracking(event.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              )}
            </>
          )
        }
        verb={pending ? ACTION_LABEL[pending.action] : ""}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </>
  );
}
