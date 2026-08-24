"use client";

// GET-and-render loader for admin console views: loading is derived (a result
// for the current path + attempt hasn't landed yet), so no state is set
// synchronously inside effects and every view gets retry for free. Mirrors
// /ops's use-ops-load.ts.
import { useEffect, useState } from "react";
import { adminApi } from "../api";

interface Landed<T> {
  path: string;
  attempt: number;
  value: T | null;
  failed: boolean;
}

export interface AdminLoad<T> {
  loading: boolean;
  failed: boolean;
  data: T | null;
  retry: () => void;
}

export function useAdminLoad<T>(path: string): AdminLoad<T> {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void adminApi<T>(path)
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
