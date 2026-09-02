"use client";

// K3 Bumped View and Recall (CAP-4, issue #71; clarity pass issue #134) - a
// horizontal rail of bumped tickets, newest-first (bumped-view-state.ts),
// rendered through the same load-bearing `TicketCard` K1 established (its
// own header already documents this: "K3 should render this same component
// against `GET .../bumped` results, not build its own ticket rendering"). A
// bumped ticket's frame is TicketCard's neutral `status === "bumped"`
// styling (no live ageing clock, no ageing color) - no new frame logic here.
// Recall is a single tap with no confirmation (EXPERIENCE.md: "recall IS the
// undo"), wired through the same `useTicketActions` K1 uses so the
// one-tap-with-retry contract is identical; bump/refire are unreachable for
// a bumped ticket (TicketCard only renders Recall for `status: "bumped"`) so
// those two callbacks are no-ops here, never called.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useKdsOutlet } from "../../kds-outlet-context";
import { KdsHeader } from "../kds-header";
import { Skeleton } from "../../data-states";
import { TicketCard } from "../station/ticket-card";
import { useTicketActions } from "../station/use-ticket-actions";
import { useBumpedQueue } from "./use-bumped-queue";
import { formatBumpedSummary, formatRecallSummary, sortBumpedNewestFirst } from "./bumped-view-state";

const NOW_TICK_MS = 1_000;

// TicketCard's ageing frame/threshold only apply to a `status: "queued"`
// ticket - every ticket here is bumped, so this value is never actually
// read, only kept because TicketCard's prop is required.
const UNUSED_AGEING_THRESHOLD_MINUTES = 10;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Mirrors station-queue-screen.tsx's identical helper - plain words, no invented precision. */
function timeAgo(lastUpdatedAt: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - lastUpdatedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

export function BumpedViewScreen() {
  const outlet = useKdsOutlet();
  const nowMs = useNow();

  const { loading, tickets, failed, lastUpdatedAt, refresh } = useBumpedQueue(outlet.id);
  const { pendingIds, errors, recall } = useTicketActions(refresh);
  const noop = useCallback(() => undefined, []);

  const ordered = tickets ? sortBumpedNewestFirst(tickets) : null;

  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="bumped" />

      {failed && lastUpdatedAt !== null && (
        <p role="status" data-testid="kds-bumped-reconnecting-notice" className="flex items-center gap-2 bg-ticket-ageing/15 px-4 py-2 text-sm font-medium text-ticket-ageing">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Reconnecting - last updated {timeAgo(lastUpdatedAt, nowMs)}
        </p>
      )}
      {failed && lastUpdatedAt === null && (
        <p role="alert" data-testid="kds-bumped-load-failed-notice" className="flex items-center gap-2 bg-ticket-urgent/15 px-4 py-2 text-sm font-medium text-ticket-urgent">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Couldn&apos;t reach the kitchen display service. Retrying.
        </p>
      )}

      {loading && (
        <div data-testid="kds-bumped-loading" className="flex flex-1 gap-4 overflow-x-auto p-4">
          <Skeleton className="h-72 w-72 shrink-0" />
          <Skeleton className="h-72 w-72 shrink-0" />
          <Skeleton className="h-72 w-72 shrink-0" />
        </div>
      )}

      {!loading && ordered && ordered.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p data-testid="kds-bumped-empty" className="font-headline text-2xl font-bold text-foreground uppercase">
            Bumped
          </p>
          <p className="text-sm text-muted-foreground">No bumped tickets</p>
        </div>
      )}

      {!loading && ordered && ordered.length > 0 && (
        <div data-testid="kds-bumped-rail" className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
          {ordered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              ageingThresholdMinutes={UNUSED_AGEING_THRESHOLD_MINUTES}
              nowMs={nowMs}
              pending={pendingIds.has(ticket.id)}
              errorMessage={errors[ticket.id] ?? null}
              onBump={noop}
              onRecall={() => recall(ticket.id)}
              onRefire={noop}
              bumpedSummary={formatBumpedSummary(ticket)}
              recallSummary={formatRecallSummary(ticket.recallHistory)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
