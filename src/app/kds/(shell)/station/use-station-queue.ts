"use client";

// K1's ~5s poll (SPEC CAP-2/EXPERIENCE.md: "tickets arrive by ~5s poll").
// Unlike usePosLoad/useKdsLoad's retry-and-blank shape, a failed poll here
// must keep the last-known board on screen (EXPERIENCE.md State Patterns:
// "failed poll keeps the last-known board, shows the reconnecting notice
// with age of data" - never blank-and-repaint, a wall display that goes
// blank is an incident). `refresh()` lets a caller (a just-issued
// bump/recall/refire) force an immediate re-poll instead of waiting out the
// rest of the interval, without disturbing the stale-on-failure contract.
import { useEffect, useState } from "react";
import { stationQueue, type TicketView } from "../../api";

const POLL_MS = 5_000;

interface QueueState {
  path: string;
  tickets: TicketView[] | null;
  failed: boolean;
  lastUpdatedAt: number | null;
}

export interface StationQueueLoad {
  /** True only until the first poll for this station has ever landed (success or failure) - never true again on a later poll cycle, so the board is never blanked mid-service. */
  loading: boolean;
  /** Last known-good tickets. Stays populated through poll failures. */
  tickets: TicketView[] | null;
  /** True when the most recent poll attempt failed - `tickets` above is still the last-known-good snapshot. */
  failed: boolean;
  /** Epoch ms of the last successful poll, for the "last updated Xs ago" reconnecting notice. */
  lastUpdatedAt: number | null;
  /** Forces an immediate poll now (e.g. right after a bump/recall/refire) instead of waiting out the rest of the interval. */
  refresh: () => void;
}

export function useStationQueue(outletId: string, stationId: string): StationQueueLoad {
  const path = `${outletId}/${stationId}`;
  const [state, setState] = useState<QueueState>({ path, tickets: null, failed: false, lastUpdatedAt: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await stationQueue(outletId, stationId);
        if (cancelled) return;
        setState((prev) => (prev.path === path ? { path, tickets: next, failed: false, lastUpdatedAt: Date.now() } : prev));
      } catch {
        if (cancelled) return;
        setState((prev) => (prev.path === path ? { ...prev, failed: true } : prev));
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [path, outletId, stationId, nonce]);

  const current = state.path === path ? state : null;
  return {
    loading: current === null || (current.tickets === null && !current.failed),
    tickets: current?.tickets ?? null,
    failed: current?.failed ?? false,
    lastUpdatedAt: current?.lastUpdatedAt ?? null,
    refresh: () => setNonce((n) => n + 1),
  };
}
