"use client";

// Sync issues (HUB-BUILD-PLAN W3, SYNC-DESIGN §7): ops the cloud rejected and
// hub sales with no op ("orphans"). Staff read them and acknowledge each one;
// fixing the underlying sale is the owner's job on the ops dead-letter page.
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { acknowledgeHubRejection, PosApiError, type HubRejection } from "../../api";
import { usePosLoad } from "../../use-pos-load";
import { LoadErrorPanel, Skeleton } from "../status/data-states";
import { formatDateTime } from "@/lib/datetime";

const TH = "font-label px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const SOURCE_LABEL: Record<HubRejection["source"], string> = { cloud: "Rejected by cloud", orphan: "Never synced" };

export function SyncIssuesScreen() {
  const { loading, failed, data, retry } = usePosLoad<{ items: HubRejection[] }>("hub/rejections");
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const items = data?.items.filter((item) => !acknowledged.has(item.opId)) ?? [];

  async function acknowledge(opId: string) {
    setPending(opId);
    setActionError(null);
    try {
      await acknowledgeHubRejection(opId);
      setAcknowledged((prev) => new Set(prev).add(opId));
    } catch (error) {
      setActionError(error instanceof PosApiError ? error.message : "Couldn't acknowledge this issue.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-lg font-semibold">Sync issues</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sales the cloud refused, or that never reached it. Acknowledge each once the owner knows.</p>
        </div>
        <button
          type="button"
          data-testid="pos-sync-issues-refresh"
          onClick={retry}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" /> Refresh
        </button>
      </header>

      {actionError && (
        <p role="alert" data-testid="pos-sync-issues-action-error" className="mb-4 rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm text-status-alert">
          {actionError}
        </p>
      )}

      {loading && (
        <div data-testid="pos-sync-issues-loading">
          <Skeleton className="h-64" />
        </div>
      )}

      {!loading && failed && <LoadErrorPanel testId="pos-sync-issues-load-error" message="Sync issues couldn't be loaded." onRetry={retry} />}

      {!loading && !failed && data && items.length === 0 && (
        <p className="rounded-lg border border-border/40 bg-card px-5 py-10 text-center text-sm text-muted-foreground" data-testid="pos-sync-issues-empty">
          No sync issues. Everything this till sold has reached the cloud.
        </p>
      )}

      {!loading && !failed && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
          <table className="w-full text-sm" data-testid="pos-sync-issues-table">
            <thead>
              <tr className="h-10 border-b border-border/40">
                <th className={TH}>Time</th>
                <th className={TH}>Source</th>
                <th className={TH}>Type</th>
                <th className={TH}>Code</th>
                <th className={TH}>Message</th>
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.opId} className="h-11 border-b border-border/20" data-testid={`pos-sync-issue-row-${item.opId}`}>
                  <td className="px-3 tabular-nums text-muted-foreground">{formatDateTime(item.at)}</td>
                  <td className="px-3">{SOURCE_LABEL[item.source]}</td>
                  <td className="px-3 font-mono text-xs">{item.type}</td>
                  <td className="px-3 font-mono text-xs">{item.code}</td>
                  <td className="px-3">{item.message}</td>
                  <td className="px-3 text-right">
                    <button
                      type="button"
                      data-testid={`pos-sync-issue-acknowledge-${item.opId}`}
                      disabled={pending !== null}
                      onClick={() => void acknowledge(item.opId)}
                      className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {pending === item.opId ? "Acknowledging…" : "Acknowledge"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
