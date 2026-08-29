"use client";

// K2's ~5s poll (SPEC CAP-3/EXPERIENCE.md), copied from station's
// use-station-queue.ts convention (issue #66's documented poll shape):
// stale-on-failure - a failed poll keeps the last-known board on screen and
// surfaces the reconnecting notice instead of ever blanking a wall display.
import { useEffect, useState } from "react";
import { expoBoard, type ExpoOrderView } from "../../api";

const POLL_MS = 5_000;

interface BoardState {
  outletId: string;
  orders: ExpoOrderView[] | null;
  failed: boolean;
  lastUpdatedAt: number | null;
}

export interface ExpoBoardLoad {
  /** True only until the first poll has ever landed (success or failure) - never true again on a later cycle. */
  loading: boolean;
  /** Last known-good orders. Stays populated through poll failures. */
  orders: ExpoOrderView[] | null;
  /** True when the most recent poll attempt failed - `orders` is still the last-known-good snapshot. */
  failed: boolean;
  /** Epoch ms of the last successful poll, for the "last updated Xs ago" reconnecting notice. */
  lastUpdatedAt: number | null;
}

export function useExpoBoard(outletId: string): ExpoBoardLoad {
  const [state, setState] = useState<BoardState>({ outletId, orders: null, failed: false, lastUpdatedAt: null });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await expoBoard(outletId);
        if (cancelled) return;
        setState((prev) => (prev.outletId === outletId ? { outletId, orders: next, failed: false, lastUpdatedAt: Date.now() } : prev));
      } catch {
        if (cancelled) return;
        setState((prev) => (prev.outletId === outletId ? { ...prev, failed: true } : prev));
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [outletId]);

  const current = state.outletId === outletId ? state : null;
  return {
    loading: current === null || (current.orders === null && !current.failed),
    orders: current?.orders ?? null,
    failed: current?.failed ?? false,
    lastUpdatedAt: current?.lastUpdatedAt ?? null,
  };
}
