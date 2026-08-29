"use client";

// K3's ~5s poll (issue #71, CAP-4) - same shape as
// station/use-station-queue.ts per the shell story's documented poll
// convention: stale-on-failure (never blank-and-repaint a live display),
// `refresh()` to re-poll immediately after a recall instead of waiting out
// the rest of the interval.
import { useEffect, useState } from "react";
import { bumpedTickets, type BumpedTicketView } from "../../api";

const POLL_MS = 5_000;

interface QueueState {
  path: string;
  tickets: BumpedTicketView[] | null;
  failed: boolean;
  lastUpdatedAt: number | null;
}

export interface BumpedQueueLoad {
  /** True only until the first poll has ever landed (success or failure) - never true again on a later cycle. */
  loading: boolean;
  /** Last known-good bumped tickets. Stays populated through poll failures. */
  tickets: BumpedTicketView[] | null;
  /** True when the most recent poll attempt failed - `tickets` is still the last-known-good snapshot. */
  failed: boolean;
  /** Epoch ms of the last successful poll, for the "last updated Xs ago" reconnecting notice. */
  lastUpdatedAt: number | null;
  /** Forces an immediate poll now (e.g. right after a recall) instead of waiting out the rest of the interval. */
  refresh: () => void;
}

export function useBumpedQueue(outletId: string): BumpedQueueLoad {
  const path = outletId;
  const [state, setState] = useState<QueueState>({ path, tickets: null, failed: false, lastUpdatedAt: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await bumpedTickets(outletId);
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
  }, [path, outletId, nonce]);

  const current = state.path === path ? state : null;
  return {
    loading: current === null || (current.tickets === null && !current.failed),
    tickets: current?.tickets ?? null,
    failed: current?.failed ?? false,
    lastUpdatedAt: current?.lastUpdatedAt ?? null,
    refresh: () => setNonce((n) => n + 1),
  };
}
