"use client";

// K2 Expo View (CAP-3, issue #70) - per-order consolidation across stations
// plus the Waiting-On sidebar. Copies K1's shell exactly (issue #66's
// documented convention for K2-K4): the 5s poll (use-expo-board.ts) plus a
// 1s "now" tick so every clock on screen keeps moving between polls, and
// the same reconnecting-notice/skeleton/empty-state shapes as
// station-queue-screen.tsx - one board, never blank-and-repaint.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useKdsOutlet } from "../../kds-outlet-context";
import { KdsHeader } from "../kds-header";
import { Skeleton } from "../../data-states";
import { listStations, type StationView } from "../../api";
import { useKdsLoad } from "../../use-kds-load";
import { useExpoBoard } from "./use-expo-board";
import { buildWaitingOnEntries, sortOrdersOldestFirst } from "./expo-state";
import { ExpoOrderRow } from "./expo-order-row";
import { WaitingOnPanel } from "./waiting-on-panel";

const NOW_TICK_MS = 1_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Seconds/minutes-ago phrasing - identical to station-queue-screen.tsx's `timeAgo`. */
function timeAgo(lastUpdatedAt: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - lastUpdatedAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

const DEFAULT_AGEING_THRESHOLD_MINUTES = 10;

export function ExpoScreen() {
  const outlet = useKdsOutlet();
  const nowMs = useNow();

  // Same station lookup as station-queue-screen.tsx, but here it drives
  // every order row's ageing clock (each ticket ages against its own
  // station's threshold) instead of a single station's.
  const loadStations = useCallback(() => listStations(outlet.id), [outlet.id]);
  const { data: stations } = useKdsLoad(`outlets/${outlet.id}/stations`, loadStations);
  const ageingThresholdMinutesFor = useCallback(
    (stationId: string | null): number => {
      const station = stationId ? stations?.find((s: StationView) => s.id === stationId) : undefined;
      return station?.ageingThresholdMinutes ?? DEFAULT_AGEING_THRESHOLD_MINUTES;
    },
    [stations],
  );

  const { loading, orders, failed, lastUpdatedAt } = useExpoBoard(outlet.id);
  const ordered = orders ? sortOrdersOldestFirst(orders) : null;
  const waitingOn = orders ? buildWaitingOnEntries(orders) : [];

  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="expo" />

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
        <div data-testid="kds-expo-loading" className="flex flex-1 gap-4 overflow-x-auto p-4">
          <Skeleton className="h-72 w-80 shrink-0" />
          <Skeleton className="h-72 w-80 shrink-0" />
          <Skeleton className="h-72 w-80 shrink-0" />
        </div>
      )}

      {!loading && ordered && ordered.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p data-testid="kds-expo-empty" className="font-headline text-2xl font-bold text-foreground uppercase">
            Expo
          </p>
          <p className="text-sm text-muted-foreground">No open orders</p>
        </div>
      )}

      {!loading && ordered && ordered.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          <div data-testid="kds-expo-rail" className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
            {ordered.map((order) => (
              <ExpoOrderRow key={order.orderId} order={order} ageingThresholdMinutesFor={ageingThresholdMinutesFor} nowMs={nowMs} />
            ))}
          </div>
          <WaitingOnPanel entries={waitingOn} ageingThresholdMinutesFor={ageingThresholdMinutesFor} nowMs={nowMs} />
        </div>
      )}
    </div>
  );
}
