"use client";

// K4 All-Day Production Summary (CAP-5, issue #72): AllDayCountGrid
// (DESIGN.md: "item -> live count tiles, large numerals") - one tile per
// item with a real, server-aggregated live count across all open (queued)
// tickets, sorted highest-count-first (all-day-summary-state.ts documents
// the choice). Counts derive only from real queued ticket lines and
// decrement on bump within a poll cycle (SPEC CAP-5) - never fabricated or
// held steady client-side between polls.
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useKdsOutlet } from "../../kds-outlet-context";
import { KdsHeader } from "../kds-header";
import { Skeleton } from "../../data-states";
import { useAllDaySummary } from "./use-all-day-summary";
import { sortHighestCountFirst } from "./all-day-summary-state";

const NOW_TICK_MS = 1_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Seconds/minutes-ago phrasing for the reconnecting notice - identical wording to K1's station-queue-screen.tsx (EXPERIENCE.md's reconnecting notice is one convention, not per-screen copy). */
function timeAgo(lastUpdatedAt: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - lastUpdatedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

export function AllDaySummaryScreen() {
  const outlet = useKdsOutlet();
  const nowMs = useNow();
  const { loading, entries, failed, lastUpdatedAt } = useAllDaySummary(outlet.id);

  const ordered = entries ? sortHighestCountFirst(entries) : null;

  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="all-day" />

      {failed && lastUpdatedAt !== null && (
        <p role="status" data-testid="kds-reconnecting-notice" className="flex items-center gap-2 bg-ticket-ageing/15 px-4 py-2 text-sm font-medium text-ticket-ageing">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Reconnecting - last updated {timeAgo(lastUpdatedAt, nowMs)}
        </p>
      )}
      {failed && lastUpdatedAt === null && (
        <p role="alert" data-testid="kds-load-failed-notice" className="flex items-center gap-2 bg-ticket-urgent/15 px-4 py-2 text-sm font-medium text-ticket-urgent">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Couldn&apos;t reach the kitchen display service. Retrying.
        </p>
      )}

      {loading && (
        <div data-testid="kds-all-day-loading" className="grid flex-1 grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {!loading && ordered && ordered.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p data-testid="kds-all-day-empty" className="font-headline text-2xl font-bold text-foreground uppercase">
            All-Day
          </p>
          <p className="text-sm text-muted-foreground">No open tickets</p>
        </div>
      )}

      {!loading && ordered && ordered.length > 0 && (
        <div data-testid="kds-all-day-grid" className="grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((entry) => (
            <div
              key={entry.itemId}
              data-testid={`kds-all-day-tile-${entry.itemId}`}
              className="flex flex-col items-center justify-center gap-2 rounded-lg bg-card p-6 text-center"
            >
              <p data-testid={`kds-all-day-tile-${entry.itemId}-count`} className="font-headline text-6xl font-bold tabular-nums text-foreground">
                {entry.quantity}
              </p>
              <p data-testid={`kds-all-day-tile-${entry.itemId}-name`} className="text-lg font-medium text-muted-foreground">
                {entry.itemName}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
