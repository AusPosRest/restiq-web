"use client";

// K4's ~5s poll (SPEC CAP-5/wiki: "K2/K4 should copy this shape... rather
// than inventing a different polling pattern"). Copied from K1's
// use-station-queue.ts - same stale-on-failure contract (EXPERIENCE.md:
// "failed poll keeps the last-known board, shows the reconnecting notice
// with age of data" applies to every KDS mode, not just the station queue -
// a wall display that blanks on one failed poll is an incident here too).
import { useEffect, useState } from "react";
import { allDaySummary, type AllDaySummaryEntryView } from "../../api";

const POLL_MS = 5_000;

interface SummaryState {
  outletId: string;
  entries: AllDaySummaryEntryView[] | null;
  failed: boolean;
  lastUpdatedAt: number | null;
}

export interface AllDaySummaryLoad {
  /** True only until the first poll has ever landed (success or failure). */
  loading: boolean;
  /** Last known-good counts. Stays populated through poll failures. */
  entries: AllDaySummaryEntryView[] | null;
  /** True when the most recent poll attempt failed - `entries` is still the last-known-good snapshot. */
  failed: boolean;
  /** Epoch ms of the last successful poll, for the "last updated Xs ago" reconnecting notice. */
  lastUpdatedAt: number | null;
}

export function useAllDaySummary(outletId: string): AllDaySummaryLoad {
  const [state, setState] = useState<SummaryState>({ outletId, entries: null, failed: false, lastUpdatedAt: null });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await allDaySummary(outletId);
        if (cancelled) return;
        setState((prev) => (prev.outletId === outletId ? { outletId, entries: next, failed: false, lastUpdatedAt: Date.now() } : prev));
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
    loading: current === null || (current.entries === null && !current.failed),
    entries: current?.entries ?? null,
    failed: current?.failed ?? false,
    lastUpdatedAt: current?.lastUpdatedAt ?? null,
  };
}
