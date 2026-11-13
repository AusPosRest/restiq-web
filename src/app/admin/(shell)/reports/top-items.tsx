"use client";

// Top-selling items (restiq-web#431 item 4, restiq-backend#288): per-outlet,
// scoped by the shell's outlet switcher with the same key={outlet.id} remount
// and outlet-local date filter as Payments. One row per item + portion,
// ranked by quantity sold, with a CSV export.
import { Download, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { AdminApiError, exportTopItems, fetchTopItems } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import type { OutletView } from "../menu/menu-state";
import { useOutlets } from "../outlet-context";
import { useToast } from "../toast";
import { DateRangeFilter } from "./date-range-filter";
import { defaultDateRange, toIsoRange, type DateRangeQuery } from "./payments-state";
import { downloadReportExport } from "./reports-state";
import { topItemLabel, type TopItemsResponse } from "./top-items-state";

const TH_CLASS = "font-label px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground";

function LoadingShell() {
  return (
    <div className="space-y-6" data-testid="top-items-loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function TopItems() {
  const { outlets, loading, failed, reload, selectedOutletId } = useOutlets();

  if (loading) return <LoadingShell />;
  if (failed) return <LoadErrorPanel testId="top-items-outlets-load-error" message="Your outlets couldn't be loaded." onRetry={reload} />;
  if (outlets.length === 0) {
    return (
      <div data-testid="top-items-no-outlets" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <TrendingUp className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No outlets yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Once your outlets are set up, your best sellers will show up here.</p>
      </div>
    );
  }

  const outlet = outlets.find((candidate) => candidate.id === selectedOutletId);
  if (!outlet) return <LoadingShell />;

  return <OutletTopItems key={outlet.id} outlet={outlet} />;
}

function OutletTopItems({ outlet }: Readonly<{ outlet: OutletView }>) {
  const toast = useToast();
  const [range, setRange] = useState<DateRangeQuery>(() => defaultDateRange(new Date(), outlet.timezone));
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<{ key: string; data: TopItemsResponse | null } | null>(null);
  const [exporting, setExporting] = useState(false);
  const key = `${range.fromDate}|${range.toDate}|${attempt}`;

  useEffect(() => {
    let cancelled = false;
    fetchTopItems({ outletId: outlet.id, ...toIsoRange(range, outlet.timezone) })
      .then((data) => !cancelled && setLanded({ key, data }))
      .catch(() => !cancelled && setLanded({ key, data: null }));
    return () => {
      cancelled = true;
    };
    // key already encodes range/attempt; outlet is fixed for this mount (key={outlet.id}).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = landed?.key === key ? landed : null;
  const data = current?.data ?? null;

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportTopItems({ outletId: outlet.id, ...toIsoRange(range, outlet.timezone) });
      downloadReportExport(result);
      toast({ kind: "success", message: `${result.filename} downloaded.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't export top items." });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Top-selling items</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your best sellers at {outlet.name}, by quantity sold on finalized bills.</p>
        </div>
        <Button variant="secondary" size="sm" data-testid="top-items-export" disabled={exporting || !data} onClick={() => void handleExport()}>
          {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <DateRangeFilter idPrefix="top-items" range={range} onChange={setRange} />

      {current === null && <Skeleton className="h-64" />}
      {current && !data && <LoadErrorPanel testId="top-items-load-error" message="Top items couldn't be loaded." onRetry={() => setAttempt((n) => n + 1)} />}

      {data && (
        <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
          {data.items.length === 0 ? (
            <div data-testid="top-items-empty" className="flex flex-col items-center gap-2 px-8 py-16 text-center">
              <TrendingUp className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-headline text-lg font-medium">No items sold in this range</p>
              <p className="max-w-sm text-sm text-muted-foreground">Try a wider date range, or check back once bills are finalized.</p>
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="top-items-table">
              <thead>
                <tr className="h-12 border-b border-border/40">
                  <th className={`${TH_CLASS} w-16 text-left`}>#</th>
                  <th className={`${TH_CLASS} text-left`}>Item</th>
                  <th className={`${TH_CLASS} text-right`}>Qty sold</th>
                  <th className={`${TH_CLASS} text-right`} title="Line totals including modifiers, before bill discounts and refunds">
                    Sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, index) => (
                  <tr key={`${row.id}:${row.variantId ?? ""}`} data-testid={`top-items-row-${index + 1}`} className="h-12 border-b border-border/20 last:border-b-0">
                    <td className="px-4 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-4 font-medium">{topItemLabel(row)}</td>
                    <td className="px-4 text-right tabular-nums">{row.quantity.toLocaleString()}</td>
                    <td className="px-4 text-right tabular-nums">{formatMoney(row.salesMinor, data.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
