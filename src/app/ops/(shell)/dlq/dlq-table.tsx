"use client";

// O9/O9a Dead-Letter Queue (CAP-7): filterable browse of permanently-rejected
// sync ops, per-row and bulk-by-filter idempotent replay. Replay results are
// never silent (EXPERIENCE.md) - they render as their own inline view with a
// summary banner and a per-op result chip, not a toast, and never navigate
// away from /ops/dlq.
import { Inbox, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeadLetterListResult, DeadLetterView, opsApi, OpsApiError, ReplayResult, ReplayStatus, TenantListResult } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { formatLag } from "../sync-health/format";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";
import {
  clearFilters,
  DlqTableQuery,
  filterChips,
  hasFilters,
  parseDlqQuery,
  REASON_CODE_LABELS,
  REASON_CODE_OPTIONS,
  toApiParams,
  toBulkFilter,
  toUrlParams,
  withFilter,
} from "./table-state";

const PAGE_SIZE = 25;

const SELECT_CLASSES =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_LABEL: Record<ReplayStatus, string> = { applied: "Applied", duplicate: "Duplicate", "rejected-again": "Rejected again" };
const STATUS_STYLE: Record<ReplayStatus, string> = {
  applied: "border-status-healthy/50 bg-status-healthy/10 text-status-healthy",
  duplicate: "border-primary/50 bg-primary/10 text-primary",
  "rejected-again": "border-status-critical/50 bg-status-critical/10 text-status-critical",
};

function ResultChip({ status, testId }: Readonly<{ status: ReplayStatus; testId: string }>) {
  return (
    <span
      data-testid={testId}
      className={`font-label inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function operationLabel(row: DeadLetterView): string {
  const kind = row.payloadMeta.kind;
  return typeof kind === "string" ? kind : "Sync operation";
}

function AgeCell({ createdAt }: Readonly<{ createdAt: string }>) {
  const [now] = useState(() => Date.now());
  const ageSeconds = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 1000));
  return <span title={new Date(createdAt).toLocaleString()}>{formatLag(ageSeconds)}</span>;
}

// A row replayed beyond the current page (bulk-by-filter can touch more ops
// than the page shows) still needs a result row - this is a documented
// simplification: it displays with the filter's own known fields rather than
// a second fetch per id.
function placeholderRow(id: string, query: DlqTableQuery): DeadLetterView {
  return {
    id,
    tenantId: query.tenantId,
    tenantName: query.tenantId ? "—" : "—",
    deviceId: query.deviceId,
    deviceLabel: query.deviceId ? "—" : "—",
    opId: id,
    reasonCode: query.reasonCode || "—",
    reasonText: "",
    payloadMeta: {},
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
}

function summarize(results: ReplayResult[]): Record<ReplayStatus, number> {
  const summary: Record<ReplayStatus, number> = { applied: 0, duplicate: 0, "rejected-again": 0 };
  for (const result of results) summary[result.status] += 1;
  return summary;
}

interface ResultsView {
  rows: DeadLetterView[];
  results: ReplayResult[];
}

function DlqResults({ view, onBack }: Readonly<{ view: ResultsView; onBack: () => void }>) {
  const summary = summarize(view.results);
  const statusOf = (id: string) => view.results.find((result) => result.id === id)?.status;

  return (
    <section className="flex flex-1 flex-col" data-testid="dlq-results">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Dead-Letter Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Replay results</p>
        </div>
        <Button variant="secondary" data-testid="dlq-results-back" onClick={onBack}>
          <RotateCcw aria-hidden="true" /> Back to queue
        </Button>
      </div>

      <div
        className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-border/40 bg-card p-4"
        data-testid="dlq-results-summary"
      >
        <p className="font-medium">
          Replay complete: {view.results.length} operation{view.results.length === 1 ? "" : "s"} processed
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-status-healthy/50 bg-status-healthy/10 px-2 py-0.5 text-xs font-semibold text-status-healthy">
          Applied {summary.applied}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          Duplicate {summary.duplicate}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-status-critical/50 bg-status-critical/10 px-2 py-0.5 text-xs font-semibold text-status-critical">
          Rejected again {summary["rejected-again"]}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-card">
        <table className="w-full text-sm" data-testid="dlq-results-table">
          <thead>
            <tr className="h-12 border-b border-border/40">
              <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operation</th>
              <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
              <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</th>
              <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason (original)</th>
              <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Result</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => {
              const status = statusOf(row.id);
              return (
                <tr
                  key={row.id}
                  data-testid={`dlq-results-row-${row.id}`}
                  className={`h-14 border-b border-border/20 last:border-b-0 ${status === "applied" ? "opacity-50" : ""}`}
                >
                  <td className="px-4">
                    {operationLabel(row)}
                    <span className="block text-xs text-muted-foreground">{row.opId.slice(0, 13)}</span>
                  </td>
                  <td className="px-4 text-muted-foreground">{row.tenantName}</td>
                  <td className="px-4 text-muted-foreground">{row.deviceLabel}</td>
                  <td className="px-4 text-muted-foreground">{REASON_CODE_LABELS[row.reasonCode] ?? row.reasonCode}</td>
                  <td className="px-4">{status && <ResultChip status={status} testId={`dlq-results-row-${row.id}-result`} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DlqTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const query = parseDlqQuery(new URLSearchParams(searchParams.toString()));

  const { loading, failed, data, retry } = useOpsLoad<DeadLetterListResult>(`dead-letters?${toApiParams(query, PAGE_SIZE)}`);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [replayTarget, setReplayTarget] = useState<DeadLetterView | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [resultsView, setResultsView] = useState<ResultsView | null>(null);

  useEffect(() => {
    void opsApi<TenantListResult>("tenants?limit=100&sort=name&order=asc").then((res) =>
      setTenants(res.tenants.map((tenant) => ({ id: tenant.id, name: tenant.name }))),
    );
  }, []);

  function navigate(next: DlqTableQuery) {
    const params = toUrlParams(next).toString();
    router.replace(params ? `${pathname}?${params}` : pathname);
  }

  const tenantNameById = (id: string) => tenants.find((tenant) => tenant.id === id)?.name;
  const deviceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.deadLetters ?? []) map.set(row.deviceId, row.deviceLabel);
    if (query.deviceId && !map.has(query.deviceId)) map.set(query.deviceId, query.deviceId);
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [data, query.deviceId]);
  const deviceLabelById = (id: string) => deviceOptions.find((device) => device.id === id)?.label;

  const chips = filterChips(query, tenantNameById, deviceLabelById);
  const filtered = hasFilters(query);

  async function confirmReplay(reason: string) {
    if (!replayTarget) return;
    setActionBusy(true);
    try {
      const result = await opsApi<ReplayResult>(`dead-letters/${replayTarget.id}/replay`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setResultsView({ rows: [replayTarget], results: [result] });
      setReplayTarget(null);
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not replay this operation." });
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmBulk(reason: string) {
    setActionBusy(true);
    try {
      const res = await opsApi<{ results: ReplayResult[] }>("dead-letters/replay-bulk", {
        method: "POST",
        body: JSON.stringify({ reason, ...toBulkFilter(query) }),
      });
      const rows = res.results.map((result) => data?.deadLetters.find((row) => row.id === result.id) ?? placeholderRow(result.id, query));
      setResultsView({ rows, results: res.results });
      setBulkConfirmOpen(false);
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not replay these operations." });
    } finally {
      setActionBusy(false);
    }
  }

  function backToQueue() {
    setResultsView(null);
    retry();
  }

  if (resultsView) return <DlqResults view={resultsView} onBack={backToQueue} />;

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Dead-Letter Queue</h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="dlq-count">
              {data.total} operation{data.total === 1 ? "" : "s"} awaiting review
            </p>
          )}
        </div>
        {data && data.total > 0 && (
          <Button data-testid="dlq-replay-all" onClick={() => setBulkConfirmOpen(true)}>
            Replay {filtered ? "matching filters" : "all"} ({data.total})
          </Button>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border/40 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            data-testid="dlq-filter-tenant"
            aria-label="Tenant"
            value={query.tenantId}
            onChange={(event) => navigate(withFilter(query, "tenantId", event.target.value))}
            className={SELECT_CLASSES}
          >
            <option value="">Tenant: All</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <select
            data-testid="dlq-filter-device"
            aria-label="Device"
            value={query.deviceId}
            onChange={(event) => navigate(withFilter(query, "deviceId", event.target.value))}
            className={SELECT_CLASSES}
          >
            <option value="">Device: All</option>
            {deviceOptions.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
          <select
            data-testid="dlq-filter-reason"
            aria-label="Reason"
            value={query.reasonCode}
            onChange={(event) => navigate(withFilter(query, "reasonCode", event.target.value))}
            className={SELECT_CLASSES}
          >
            <option value="">Reason: All</option>
            {REASON_CODE_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {REASON_CODE_LABELS[code]}
              </option>
            ))}
          </select>
        </div>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="dlq-filter-chips">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-[6px] border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
              >
                {chip.label}
              </span>
            ))}
            <button
              type="button"
              data-testid="dlq-clear-filters"
              onClick={() => navigate(clearFilters())}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {failed ? (
          <div className="p-4">
            <LoadErrorPanel message="The dead-letter queue could not be loaded." onRetry={retry} testId="dlq-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="dlq-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operation</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failed At</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "dlq-loading" : undefined}>
                    {Array.from({ length: 6 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                data?.deadLetters.map((row) => (
                  <tr key={row.id} data-testid={`dlq-row-${row.id}`} className="h-14 border-b border-border/20 last:border-b-0">
                    <td className="px-4">
                      {operationLabel(row)}
                      <span className="block text-xs text-muted-foreground">{row.opId.slice(0, 13)}</span>
                    </td>
                    <td className="px-4 text-muted-foreground">{row.tenantName}</td>
                    <td className="px-4 text-muted-foreground">{row.deviceLabel}</td>
                    <td className="px-4">
                      <span
                        data-testid={`dlq-row-${row.id}-reason`}
                        className="font-label inline-flex items-center rounded-[6px] border border-status-warning/50 bg-status-warning/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-status-warning"
                        title={row.reasonText}
                      >
                        {REASON_CODE_LABELS[row.reasonCode] ?? row.reasonCode}
                      </span>
                    </td>
                    <td className="px-4 text-muted-foreground">
                      <AgeCell createdAt={row.createdAt} />
                    </td>
                    <td className="px-4">
                      <div className="flex justify-end">
                        <Button variant="secondary" size="sm" data-testid={`dlq-replay-${row.id}`} onClick={() => setReplayTarget(row)}>
                          Replay
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {!loading && data && data.deadLetters.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
            {filtered ? (
              <div data-testid="dlq-filtered-empty">
                <p className="font-headline text-lg font-medium">No results for these filters</p>
                <Button variant="secondary" size="sm" className="mt-3" data-testid="dlq-filtered-empty-clear" onClick={() => navigate(clearFilters())}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div data-testid="dlq-empty">
                <p className="font-headline text-lg font-medium">The queue is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">Rejected ops that need a human look will show up here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && data && (data.nextCursor || query.cursor) && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {query.cursor && (
            <Button variant="secondary" size="sm" data-testid="dlq-first-page" onClick={() => navigate({ ...query, cursor: "" })}>
              First page
            </Button>
          )}
          {data.nextCursor && (
            <Button variant="secondary" size="sm" data-testid="dlq-next-page" onClick={() => navigate({ ...query, cursor: data.nextCursor ?? "" })}>
              Next
            </Button>
          )}
        </div>
      )}

      <ConfirmReasonDialog
        open={replayTarget !== null}
        title={`Replay ${operationLabel(replayTarget ?? placeholderRow("", query))} on ${replayTarget?.deviceLabel ?? ""}?`}
        description="Replaying checks the idempotency ledger first: an already-applied op returns duplicate with no second effect."
        verb="Replay operation"
        busy={actionBusy}
        onCancel={() => setReplayTarget(null)}
        onConfirm={(reason) => void confirmReplay(reason)}
      />

      <ConfirmReasonDialog
        open={bulkConfirmOpen}
        title={`Replay ${data?.total ?? 0} operation${data?.total === 1 ? "" : "s"} matching the current filters?`}
        description="Each op is checked against the idempotency ledger individually - already-applied ops come back duplicate, nothing is double-applied."
        verb="Replay all"
        busy={actionBusy}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={(reason) => void confirmBulk(reason)}
      />
    </section>
  );
}
