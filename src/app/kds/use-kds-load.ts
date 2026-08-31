"use client";

// GET-and-render loader for one-shot KDS reads (the station picker's station
// list). Mirrors src/app/pos/use-pos-load.ts exactly - loading is derived (no
// landed result for this path+attempt yet), so no state is set synchronously
// inside the effect body. The live-polling station queue has its own hook
// (station/use-station-queue.ts) since it needs stale-on-failure, not retry-
// and-blank.
import { useEffect, useState } from "react";

interface Landed<T> {
  path: string;
  attempt: number;
  value: T | null;
  failed: boolean;
}

export interface KdsLoad<T> {
  loading: boolean;
  failed: boolean;
  data: T | null;
  retry: () => void;
}

export function useKdsLoad<T>(path: string, load: (path: string) => Promise<T>): KdsLoad<T> {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load(path)
      .then((value) => {
        if (!cancelled) setLanded({ path, attempt, value, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ path, attempt, value: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt, load]);

  const current = landed !== null && landed.path === path && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current && !current.failed ? current.value : null,
    retry: () => setAttempt((n) => n + 1),
  };
}
