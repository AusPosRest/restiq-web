"use client";

// GET-and-render loader for POS views: loading is derived (a result for the
// current path + attempt hasn't landed yet), so no state is set synchronously
// inside effects and every view gets retry for free. Mirrors /admin's
// use-admin-load.ts / /ops's use-ops-load.ts.
import { useEffect, useState } from "react";
import { posApi } from "./api";

interface Landed<T> {
  path: string;
  attempt: number;
  value: T | null;
  failed: boolean;
}

export interface PosLoad<T> {
  loading: boolean;
  failed: boolean;
  data: T | null;
  retry: () => void;
}

export function usePosLoad<T>(path: string): PosLoad<T> {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void posApi<T>(path)
      .then((value) => {
        if (!cancelled) setLanded({ path, attempt, value, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ path, attempt, value: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const current = landed !== null && landed.path === path && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current && !current.failed ? current.value : null,
    retry: () => setAttempt((n) => n + 1),
  };
}
