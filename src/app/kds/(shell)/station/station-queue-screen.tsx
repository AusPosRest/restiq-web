"use client";

// K1 Station Queue (CAP-2, issue #66) - StationColumnRail: an oldest-left
// horizontal queue of TicketCards (DESIGN.md). The screen owns exactly two
// timers: the 5s data poll (use-station-queue.ts) and a 1s "now" tick that
// recomputes every card's ageing color/elapsed time between polls
// (EXPERIENCE.md: "ageing color changes are computed client-side from
// firedAt + thresholds between polls so urgency never waits for a fetch").
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useKdsOutlet } from "../../kds-outlet-context";
import { KdsHeader } from "../kds-header";
import { Skeleton } from "../../data-states";
import { listStations, type StationView } from "../../api";
import { useKdsLoad } from "../../use-kds-load";
import { useStationQueue } from "./use-station-queue";
import { useTicketActions } from "./use-ticket-actions";
import { sortOldestFirst } from "./station-queue-state";
import { TicketCard } from "./ticket-card";

const NOW_TICK_MS = 1_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Seconds/minutes-ago phrasing for the reconnecting notice - plain words, per EXPERIENCE.md's one voice exception ("a failed poll... states plainly what happened"). */
function timeAgo(lastUpdatedAt: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - lastUpdatedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

function stationLookup(stations: StationView[] | null, stationId: string): StationView | undefined {
  return stations?.find((station) => station.id === stationId);
}

export function StationQueueScreen({ stationId }: Readonly<{ stationId: string }>) {
  const outlet = useKdsOutlet();
  const nowMs = useNow();

  // Only used to resolve the station's display name and its
  // ageingThresholdMinutes for the ageing frame - the queue's tickets come
  // from useStationQueue's own poll below, never composed from this read.
  // useCallback keeps this stable across renders - see kds-entry.tsx's
  // identical comment (an inline lambda recreated every render would make
  // useKdsLoad's effect re-fetch in a loop).
  const loadStations = useCallback(() => listStations(outlet.id), [outlet.id]);
  const { data: stations } = useKdsLoad(`outlets/${outlet.id}/stations`, loadStations);
  const station = stationLookup(stations, stationId);
  const stationName = stationId === "unrouted" ? "Unrouted" : (station?.name ?? "Station");
  const ageingThresholdMinutes = station?.ageingThresholdMinutes ?? 10;

  const { loading, tickets, failed, lastUpdatedAt, refresh } = useStationQueue(outlet.id, stationId);
  const { pendingIds, errors, bump, recall, refire } = useTicketActions(refresh);

  const ordered = tickets ? sortOldestFirst(tickets) : null;

  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="station" stationName={stationName} />

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
        <div data-testid="kds-station-loading" className="flex flex-1 gap-4 overflow-x-auto p-4">
          <Skeleton className="h-72 w-72 shrink-0" />
          <Skeleton className="h-72 w-72 shrink-0" />
          <Skeleton className="h-72 w-72 shrink-0" />
        </div>
      )}

      {!loading && ordered && ordered.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p data-testid="kds-station-empty" className="font-headline text-2xl font-bold text-foreground uppercase">
            {stationName}
          </p>
          <p className="text-sm text-muted-foreground">No open tickets</p>
        </div>
      )}

      {!loading && ordered && ordered.length > 0 && (
        <div data-testid="kds-station-rail" className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
          {ordered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              ageingThresholdMinutes={ageingThresholdMinutes}
              nowMs={nowMs}
              pending={pendingIds.has(ticket.id)}
              errorMessage={errors[ticket.id] ?? null}
              onBump={() => bump(ticket.id)}
              onRecall={() => recall(ticket.id)}
              onRefire={() => refire(ticket.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
