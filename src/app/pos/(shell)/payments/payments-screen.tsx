"use client";

// Payment history (issue #253): every payment taken at this outlet today,
// newest first, with per-method totals on top. Read-only; five-state
// pattern like status/device-status-screen.tsx. "Today" is decided by the
// backend in the outlet's own timezone, so the screen never computes dates.
//
// Refund entry point (issue #405): the backend only lists tenders on
// finalised bills, so every bill here is refundable. Its newest row carries
// one Refund link; the refund screen does the rest, manager PIN included.
//
// Refunds owed (issue #386): a card payment that succeeded after its bill was
// already paid is not added to the bill; the backend flags it and this panel
// tells staff to refund the guest in the card provider's dashboard.
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { PaymentHistoryEntry, PaymentHistoryView } from "../../api";
import { usePosLoad } from "../../use-pos-load";
import { TENDER_METHOD_LABEL } from "../../orders/[orderId]/settle/bill-state";
import { formatMinor } from "../shift/shift-state";
import { LoadErrorPanel, Skeleton } from "../status/data-states";
import { DATE_LOCALE } from "@/lib/datetime";

const METHOD_LABEL: Record<string, string> = { ...TENDER_METHOD_LABEL, external: "External" };
const TH = "font-label px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(DATE_LOCALE, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string): string {
  return `${new Date(iso).toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" })}, ${formatTime(iso)}`;
}

function billLabel(payment: PaymentHistoryEntry): string {
  const parts = [payment.billNumber !== null ? `#${payment.billNumber}` : "", payment.tableLabel ?? (payment.tokenNumber !== null ? `Token ${payment.tokenNumber}` : "")];
  return parts.filter(Boolean).join(" · ") || "—";
}

/** "2026-10-11" (the outlet's calendar day) -> "11 Oct 2026" (PE-19: no raw ISO dates on screen). */
function formatDay(isoDay: string): string {
  const day = new Date(`${isoDay}T00:00:00Z`);
  return Number.isNaN(day.getTime()) ? isoDay : day.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function PaymentsScreen({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<PaymentHistoryView>(`outlets/${encodeURIComponent(outletId)}/payments`);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-lg font-semibold">Payments today</h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="pos-payments-summary">
              {data.count} payment{data.count === 1 ? "" : "s"} · {formatMinor(data.totalMinor, data.currency)} · {formatDay(data.date)}
            </p>
          )}
        </div>
        <button
          type="button"
          data-testid="pos-payments-refresh"
          onClick={retry}
          disabled={loading}
          className="flex max-md:min-h-10 items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" /> Refresh
        </button>
      </header>

      {loading && (
        <div data-testid="pos-payments-loading" className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-64" />
        </div>
      )}

      {!loading && failed && <LoadErrorPanel testId="pos-payments-load-error" message="Today's payments couldn't be loaded." onRetry={retry} />}

      {!loading && !failed && data && (
        <div data-testid="pos-payments-content" className="space-y-6">
          {data.refundsDue && data.refundsDue.length > 0 && (
            <div role="status" data-testid="pos-payments-refunds-due" className="rounded-lg border border-status-alert/40 px-4 py-3 text-sm">
              <h2 className="font-headline font-semibold text-status-alert">
                Refunds owed (<span data-testid="pos-payments-refunds-due-count">{data.refundsDue.length}</span>)
              </h2>
              <p className="mt-1 text-muted-foreground">
                These card payments went through after the bill was already paid. The customer was charged and needs a refund. Refund each one in your card provider&apos;s dashboard.
              </p>
              <ul className="mt-3 space-y-2">
                {data.refundsDue.map((refund) => (
                  <li key={refund.id} data-testid={`pos-payments-refund-due-${refund.id}`} className="flex flex-col gap-0.5 border-t border-status-alert/20 pt-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4">
                    <span className="tabular-nums text-muted-foreground">{formatDateTime(refund.flaggedAt)}</span>
                    {refund.billNumber !== null && <span>Bill #{refund.billNumber}</span>}
                    {(refund.tableLabel || refund.tokenNumber !== null) && <span>{refund.tableLabel ? `Table ${refund.tableLabel}` : `Token ${refund.tokenNumber}`}</span>}
                    <span>{methodLabel(refund.method)}</span>
                    <span className="font-medium tabular-nums">{formatMinor(refund.amountMinor, data.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.byMethod.length > 0 && (
            <div className="flex flex-wrap gap-3" data-testid="pos-payments-totals">
              {data.byMethod.map((total) => (
                <div key={total.method} className="min-w-36 rounded-lg border border-border/40 bg-card px-4 py-3" data-testid={`pos-payments-total-${total.method}`}>
                  <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">{methodLabel(total.method)}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinor(total.amountMinor, data.currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {total.count} payment{total.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.payments.length === 0 ? (
            <p className="rounded-lg border border-border/40 bg-card px-5 py-10 text-center text-sm text-muted-foreground" data-testid="pos-payments-empty">
              No payments have been taken at this outlet yet today.
            </p>
          ) : (
            <div className="relative overflow-x-auto rounded-lg border border-border/40 bg-card">
              <table className="w-full text-sm" data-testid="pos-payments-table">
                <thead>
                  <tr className="h-10 border-b border-border/40">
                    <th className={TH}>Time</th>
                    <th className={TH}>Bill</th>
                    <th className={TH}>Method</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={TH}>Reference</th>
                    <th className={TH}>Taken by</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment, index) => (
                    <tr key={payment.id} className="h-11 border-b border-border/20" data-testid={`pos-payment-row-${payment.id}`}>
                      <td className="px-3 tabular-nums text-muted-foreground">{formatTime(payment.createdAt)}</td>
                      <td className="px-3">{billLabel(payment)}</td>
                      <td className="px-3">{methodLabel(payment.method)}</td>
                      <td className="px-3 text-right font-medium tabular-nums">{formatMinor(payment.amountMinor, data.currency)}</td>
                      <td className="px-3 text-muted-foreground">{payment.reference ?? "—"}</td>
                      <td className="px-3">{payment.takenBy?.name ?? "—"}</td>
                      <td className="px-3 text-right">
                        {data.payments.findIndex((other) => other.billId === payment.billId) === index && (
                          <Link
                            href={`/pos/orders/${encodeURIComponent(payment.orderId)}/refund?billId=${encodeURIComponent(payment.billId)}`}
                            data-testid={`pos-payment-refund-${payment.billId}`}
                            className="inline-flex max-md:min-h-10 items-center rounded-md px-2 py-1 text-xs font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Refund
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
