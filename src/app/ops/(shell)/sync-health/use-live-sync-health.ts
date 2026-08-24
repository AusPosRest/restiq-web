"use client";

// Live-polling loader for O8: EXPERIENCE.md forbids auto-reordering a table
// under the operator's cursor, so a background poll never overwrites what is
// on screen - it lands in `pending` and surfaces as an "N updates - refresh"
// chip; clicking the chip promotes the already-fetched snapshot instantly.
// Mirrors useOpsLoad's derived-loading pattern (loading is "no landed result
// for this path + attempt yet", never a setState inside the effect body).
import { useEffect, useState } from "react";
import { opsApi, SyncHealthResult } from "../api";

const POLL_MS = 30_000;

/** Rows that differ between two snapshots (by id, or added/removed) - the "N" in the refresh chip. Pure, unit-tested. */
export function diffCount(shown: SyncHealthResult | null, next: SyncHealthResult): number {
  if (!shown) return 0;
  const prior = new Map(shown.devices.map((d) => [d.deviceId, JSON.stringify(d)]));
  const nextIds = new Set(next.devices.map((d) => d.deviceId));
  let changed = 0;
  for (const device of next.devices) {
    if (prior.get(device.deviceId) !== JSON.stringify(device)) changed += 1;
  }
  for (const id of prior.keys()) {
    if (!nextIds.has(id)) changed += 1;
  }
  return changed;
}

interface Landed {
  path: string;
  attempt: number;
  value: SyncHealthResult | null;
  failed: boolean;
}

export interface LiveSyncHealth {
  loading: boolean;
  failed: boolean;
  data: SyncHealthResult | null;
  pendingCount: number;
  refresh: () => void;
  retry: () => void;
}

export function useLiveSyncHealth(path: string): LiveSyncHealth {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [pending, setPending] = useState<SyncHealthResult | null>(null);

  const current = landed !== null && landed.path === path && landed.attempt === attempt ? landed : null;
  const data = current && !current.failed ? current.value : null;

  useEffect(() => {
    let cancelled = false;
    void opsApi<SyncHealthResult>(path)
      .then((value) => {
        if (!cancelled) setLanded({ path, attempt, value, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ path, attempt, value: null, failed: true });
      });

    const id = setInterval(() => {
      void opsApi<SyncHealthResult>(path)
        .then((value) => {
          if (!cancelled) setPending(value);
        })
        .catch(() => undefined);
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [path, attempt]);

  function refresh(): void {
    if (pending) {
      setLanded({ path, attempt, value: pending, failed: false });
      setPending(null);
      return;
    }
    setAttempt((n) => n + 1);
  }

  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data,
    pendingCount: pending ? diffCount(data, pending) : 0,
    refresh,
    retry: () => setAttempt((n) => n + 1),
  };
}
