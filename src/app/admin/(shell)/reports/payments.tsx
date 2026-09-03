"use client";

// Payments history (issue #137, web half of restiq-backend#104's report):
// per-outlet, scoped by the shell's outlet switcher - same key={outlet.id}
// remount shape as Devices/Floor Plan so a filter/page in flight for outlet
// A can never bleed into outlet B. A date-range filter (default: today,
// outlet-local - payments-state.ts's outlet-local date math), a totals strip,
// one row per bill with cursor-paginated "Load more", and a CSV export
// reusing CAP-9's download helper (reports-state.ts#downloadReportExport).
import { Download, Loader2, Receipt } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, exportPayments, fetchPayments } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { KpiStatCard } from "../dashboard/kpi-stat-card";
import { formatPriceMinor } from "../menu/menu-state";
import type { OutletView } from "../menu/menu-state";
import { useOutlets } from "../outlet-context";
import { useToast } from "../toast";
import { downloadReportExport } from "./reports-state";
import {
  appendPaymentsPage,
  defaultDateRange,
  formatBillTime,
  PAYMENTS_PAGE_SIZE,
  refundedMinorFor,
  sourceLabel,
  tableOrTokenLabel,
  taxLines,
  toIsoRange,
  type DateRangeQuery,
  type PaymentRow,
  type PaymentsResponse,
} from "./payments-state";

const CURRENCY = "INR";

const DATE_INPUT_CLASS =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const FILTER_LABEL_CLASS = "font-label mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

function LoadingShell() {
  return (
    <div className="space-y-6" data-testid="payments-loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function Payments() {
  const { outlets, loading: outletsLoading, selectedOutletId } = useOutlets();

  if (outletsLoading) return <LoadingShell />;

  if (outlets.length === 0) {
    return (
      <div
        data-testid="payments-no-outlets"
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center"
      >
        <Receipt className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No outlets yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Once your outlets are set up, finalized bills will show up here.</p>
      </div>
    );
  }

  const outlet = outlets.find((candidate) => candidate.id === selectedOutletId);
  if (!outlet) return <LoadingShell />;

  return <OutletPayments key={outlet.id} outlet={outlet} />;
}

interface PaymentsLanded {
  key: string;
  failed: boolean;
  data: PaymentsResponse | null;
}

function usePaymentsData(outletId: string, timeZone: string, range: DateRangeQuery) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<PaymentsLanded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const key = `${outletId}|${range.fromDate}|${range.toDate}|${attempt}`;

  useEffect(() => {
    let cancelled = false;
    const { from, to } = toIsoRange(range, timeZone);
    fetchPayments({ outletId, from, to, limit: PAYMENTS_PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setLanded({ key, failed: false, data: res });
      })
      .catch(() => {
        if (!cancelled) setLanded({ key, failed: true, data: null });
      });
    return () => {
      cancelled = true;
    };
    // key is derived from outletId/range/attempt below - listing them (not
    // key itself) keeps the effect re-running exactly when one of them changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, range.fromDate, range.toDate, attempt, timeZone]);

  const current = landed && landed.key === key ? landed : null;

  async function loadMore(): Promise<void> {
    if (!current?.data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const { from, to } = toIsoRange(range, timeZone);
      const page = await fetchPayments({ outletId, from, to, cursor: current.data.nextCursor, limit: PAYMENTS_PAGE_SIZE });
      setLanded((prev) => (prev && prev.key === key && prev.data ? { ...prev, data: appendPaymentsPage(prev.data, page) } : prev));
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current?.data ?? null,
    retry: () => setAttempt((n) => n + 1),
    loadMore,
    loadingMore,
  };
}

function OutletPayments({ outlet }: Readonly<{ outlet: OutletView }>) {
  const toast = useToast();
  const [range, setRange] = useState<DateRangeQuery>(() => defaultDateRange(new Date(), outlet.timezone));
  const { loading, failed, data, retry, loadMore, loadingMore } = usePaymentsData(outlet.id, outlet.timezone, range);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const { from, to } = toIsoRange(range, outlet.timezone);
      const result = await exportPayments({ outletId: outlet.id, from, to });
      downloadReportExport(result);
      toast({ kind: "success", message: `${result.filename} downloaded.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't export payments." });
    } finally {
      setExporting(false);
    }
  }

  async function handleLoadMore() {
    try {
      await loadMore();
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't load more payments." });
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every finalized bill at {outlet.name}, with totals and a CSV export.</p>
        </div>
        <Button variant="secondary" size="sm" data-testid="payments-export" disabled={exporting || !data} onClick={() => void handleExport()}>
          {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/40 bg-card p-4">
        <div>
          <label htmlFor="payments-filter-from" className={FILTER_LABEL_CLASS}>
            From
          </label>
          <input
            id="payments-filter-from"
            data-testid="payments-filter-from"
            type="date"
            value={range.fromDate}
            max={range.toDate}
            onChange={(event) => setRange((current) => ({ ...current, fromDate: event.target.value }))}
            className={DATE_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="payments-filter-to" className={FILTER_LABEL_CLASS}>
            To
          </label>
          <input
            id="payments-filter-to"
            data-testid="payments-filter-to"
            type="date"
            value={range.toDate}
            min={range.fromDate}
            onChange={(event) => setRange((current) => ({ ...current, toDate: event.target.value }))}
            className={DATE_INPUT_CLASS}
          />
        </div>
      </div>

      {failed && <LoadErrorPanel testId="payments-load-error" message="Payments couldn't be loaded." onRetry={retry} />}

      {loading && !failed && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {!loading && !failed && data && (
        <PaymentsView data={data} outlet={outlet} onLoadMore={() => void handleLoadMore()} loadingMore={loadingMore} />
      )}
    </div>
  );
}

function PaymentsView({
  data,
  outlet,
  onLoadMore,
  loadingMore,
}: Readonly<{ data: PaymentsResponse; outlet: OutletView; onLoadMore: () => void; loadingMore: boolean }>) {
  const { totals } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7" data-testid="payments-totals">
        <KpiStatCard testId="payments-totals-count" label="Bills">
          <p className="text-2xl font-semibold tabular-nums">{totals.count.toLocaleString()}</p>
        </KpiStatCard>
        <KpiStatCard testId="payments-totals-subtotal" label="Subtotal">
          <p className="text-2xl font-semibold tabular-nums">{formatPriceMinor(totals.subtotalMinor, CURRENCY)}</p>
        </KpiStatCard>
        <KpiStatCard testId="payments-totals-discount" label="Discount">
          <p className="text-2xl font-semibold tabular-nums">{formatPriceMinor(totals.discountMinor, CURRENCY)}</p>
        </KpiStatCard>
        <KpiStatCard testId="payments-totals-tax" label="Tax">
          <p className="text-2xl font-semibold tabular-nums">{formatPriceMinor(totals.taxMinor, CURRENCY)}</p>
        </KpiStatCard>
        <KpiStatCard testId="payments-totals-total" label="Total">
          <p className="text-2xl font-semibold tabular-nums">{formatPriceMinor(totals.totalMinor, CURRENCY)}</p>
        </KpiStatCard>
        <KpiStatCard testId="payments-totals-tendered" label="Tendered">
          <p className="text-2xl font-semibold tabular-nums">{formatPriceMinor(totals.tenderedMinor, CURRENCY)}</p>
        </KpiStatCard>
        <KpiStatCard testId="payments-totals-refunded" label="Refunded">
          <p className="text-2xl font-semibold tabular-nums">{formatPriceMinor(totals.refundedMinor, CURRENCY)}</p>
        </KpiStatCard>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
        {data.items.length === 0 ? (
          <div data-testid="payments-empty" className="flex flex-col items-center gap-2 px-8 py-16 text-center">
            <Receipt className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-headline text-lg font-medium">No payments in this range</p>
            <p className="max-w-sm text-sm text-muted-foreground">Try a wider date range, or check back once bills are finalized today.</p>
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="payments-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Table / Token</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cashier</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subtotal</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tax</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenders</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Refunded</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <PaymentRowLine key={row.billId} row={row} timeZone={outlet.timezone} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.nextCursor && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" data-testid="payments-load-more" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function PaymentRowLine({ row, timeZone }: Readonly<{ row: PaymentRow; timeZone: string }>) {
  const refunded = refundedMinorFor(row);

  return (
    <tr data-testid={`payments-row-${row.billId}`} className="h-14 border-b border-border/20 last:border-b-0">
      <td className="px-4 text-muted-foreground">{formatBillTime(row.finalizedAt, timeZone)}</td>
      <td className="px-4">
        <Link
          href={`/pos/bills/${row.billId}/invoice`}
          data-testid={`payments-row-${row.billId}-link`}
          className="font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          #{row.billNumber}
        </Link>
      </td>
      <td className="px-4 text-muted-foreground">{tableOrTokenLabel(row)}</td>
      <td className="px-4 text-muted-foreground">{sourceLabel(row.source)}</td>
      <td className="px-4 text-muted-foreground">{row.cashierName ?? "—"}</td>
      <td className="px-4 text-right tabular-nums">{formatPriceMinor(row.subtotalMinor, CURRENCY)}</td>
      <td className="px-4 text-right tabular-nums" title={row.discountReason ?? undefined}>
        {row.discountMinor ? formatPriceMinor(row.discountMinor, CURRENCY) : "—"}
      </td>
      <td className="px-4 text-right tabular-nums">
        {taxLines(row).map((line, i) => (
          <div key={i}>
            {line.label && <span className="text-xs text-muted-foreground">{line.label}: </span>}
            {formatPriceMinor(line.amountMinor, CURRENCY)}
          </div>
        ))}
      </td>
      <td className="px-4 text-right tabular-nums font-medium">{formatPriceMinor(row.totalMinor, CURRENCY)}</td>
      <td className="px-4">
        <div className="flex flex-wrap gap-1">
          {row.tenders.map((tender, i) => (
            <span key={i} className="inline-flex items-center rounded-[6px] border border-border/60 bg-accent/40 px-2 py-0.5 text-xs">
              {tender.method}={formatPriceMinor(tender.amountMinor, CURRENCY)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 text-right tabular-nums">{refunded ? formatPriceMinor(refunded, CURRENCY) : "—"}</td>
    </tr>
  );
}
