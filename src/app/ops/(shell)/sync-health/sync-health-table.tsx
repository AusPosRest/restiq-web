"use client";

// O8 Sync Health (CAP-6): severity-sorted fleet table. The backend already
// sorts silent > lagging > healthy and computes severity/lag - this view
// renders that order, never re-sorts client-side, and never auto-refreshes
// under the operator's cursor (EXPERIENCE.md) - live updates land as an
// "N updates - refresh" chip instead.
import { AlertTriangle, Radio, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SyncHealthRow } from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { StatusBadge } from "../status-badge";
import { formatClockSkew, formatLag } from "./format";
import { clearFilter, FILTER_LABELS, FILTER_VALUES, parseSyncHealthQuery, toApiParams, toUrlParams, withFilter } from "./table-state";
import { useLiveSyncHealth } from "./use-live-sync-health";

const SELECT_CLASSES =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SUMMARY_TILES: Array<{ key: "healthy" | "lagging" | "silent"; label: string }> = [
  { key: "healthy", label: "Healthy" },
  { key: "lagging", label: "Lagging" },
  { key: "silent", label: "Silent" },
];

function UpdatedAgo({ generatedAt }: Readonly<{ generatedAt: string }>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(generatedAt)) / 1000));
  return (
    <span data-testid="sync-health-updated-ago" className="text-xs text-muted-foreground">
      Updated {seconds}s ago
    </span>
  );
}

function LastContactCell({ row }: Readonly<{ row: SyncHealthRow }>) {
  const absolute = row.lastContactAt ? new Date(row.lastContactAt).toLocaleString() : null;
  const relative = row.lastContactAt ? formatLag(row.lagSeconds) : "Never contacted";

  if (row.severity !== "silent") {
    return (
      <span title={absolute ?? undefined} className="text-muted-foreground">
        {relative}
      </span>
    );
  }

  return (
    <div title={absolute ?? undefined}>
      <span data-testid={`sync-health-row-${row.deviceId}-alert`} className="flex items-center gap-1.5 font-medium text-status-critical">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" /> {relative}
      </span>
      {absolute && <span className="text-xs text-status-critical/80">Silent since {absolute}</span>}
    </div>
  );
}

export function SyncHealthTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseSyncHealthQuery(new URLSearchParams(searchParams.toString()));

  const { loading, failed, data, pendingCount, refresh, retry } = useLiveSyncHealth(`sync-health?${toApiParams(query)}`);

  function navigate(next: typeof query) {
    const params = toUrlParams(next).toString();
    router.replace(params ? `${pathname}?${params}` : pathname);
  }

  const allRows = data?.devices ?? [];
  const rows = query.filter === "rejections" ? allRows.filter((row) => (row.recentRejectionCount ?? 0) > 0) : allRows;
  const filtered = query.filter !== "";
  const emptyFiltered = !loading && data && rows.length === 0 && filtered;
  const trueEmpty = !loading && data && rows.length === 0 && !filtered;

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-2xl font-semibold">Sync Health</h1>
            {data && <UpdatedAgo generatedAt={data.generatedAt} />}
          </div>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="sync-health-count">
              {rows.length} device{rows.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {pendingCount > 0 && (
          <button
            type="button"
            data-testid="sync-health-refresh-chip"
            onClick={refresh}
            className="flex h-8 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" /> {pendingCount} update{pendingCount === 1 ? "" : "s"} · Refresh
          </button>
        )}
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {SUMMARY_TILES.map((tile) => (
            <button
              key={tile.key}
              type="button"
              data-testid={`sync-health-summary-${tile.key}`}
              onClick={() => navigate(withFilter(query, query.filter === tile.key ? "" : tile.key))}
              className={`rounded-lg border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                query.filter === tile.key ? "border-primary/60 bg-primary/10" : "border-border/40 bg-card hover:border-border"
              }`}
            >
              <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tile.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data.summary[tile.key]}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          data-testid="sync-health-filter"
          aria-label="Filter"
          value={query.filter}
          onChange={(event) => navigate(withFilter(query, event.target.value as (typeof FILTER_VALUES)[number] | ""))}
          className={SELECT_CLASSES}
        >
          <option value="">All devices</option>
          {FILTER_VALUES.map((value) => (
            <option key={value} value={value}>
              {FILTER_LABELS[value]}
            </option>
          ))}
        </select>
        {filtered && (
          <div className="flex items-center gap-2" data-testid="sync-health-filter-chips">
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary">
              {FILTER_LABELS[query.filter as (typeof FILTER_VALUES)[number]]}
            </span>
            <button
              type="button"
              data-testid="sync-health-clear-filter"
              onClick={() => navigate(clearFilter(query))}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {failed ? (
          <div className="p-4">
            <LoadErrorPanel message="Sync health could not be loaded." onRetry={retry} testId="sync-health-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="sync-health-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tenant &amp; Outlet
                </th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Severity</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Last Contact
                </th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Outbox Depth
                </th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  App Version
                </th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clock Skew
                </th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rejections
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "sync-health-loading" : undefined}>
                    {Array.from({ length: 8 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                rows.map((row) => (
                  <tr
                    key={row.deviceId}
                    data-testid={`sync-health-row-${row.deviceId}`}
                    data-severity={row.severity}
                    className={`h-14 border-b border-b-border/20 border-l-4 last:border-b-0 ${
                      row.severity === "silent" ? "border-l-status-critical bg-status-critical/5" : "border-l-transparent"
                    }`}
                  >
                    <td className="px-4 font-medium">
                      {row.deviceLabel}
                      <span className="ml-1.5 text-xs text-muted-foreground">{row.deviceType.toUpperCase()}</span>
                    </td>
                    <td className="px-4 text-muted-foreground">
                      {row.tenantName}
                      {row.outletName && <span className="block text-xs">{row.outletName}</span>}
                    </td>
                    <td className="px-4">
                      <StatusBadge status={row.severity} testId={`sync-health-row-${row.deviceId}-severity`} />
                    </td>
                    <td className="px-4">
                      <LastContactCell row={row} />
                    </td>
                    <td className="px-4 tabular-nums">{row.outboxDepth ?? "-"}</td>
                    <td className="px-4 text-muted-foreground">{row.appVersion ?? "-"}</td>
                    <td className="px-4 tabular-nums text-muted-foreground">
                      {row.clockSkewSeconds === null ? "-" : formatClockSkew(row.clockSkewSeconds)}
                    </td>
                    <td className="px-4 tabular-nums">{row.recentRejectionCount ?? "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {trueEmpty && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center" data-testid="sync-health-empty">
            <Radio className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-headline text-lg font-medium">No devices to monitor yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Sync health appears here once devices are enrolled and start heartbeating.</p>
          </div>
        )}

        {emptyFiltered && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center" data-testid="sync-health-filtered-empty">
            <Radio className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-headline text-lg font-medium">No results for these filters</p>
            <Button variant="secondary" size="sm" className="mt-3" data-testid="sync-health-filtered-empty-clear" onClick={() => navigate(clearFilter(query))}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
