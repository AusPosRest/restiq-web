"use client";

// GET-and-render loader for console views: loading is derived (a result for
// the current path + attempt hasn't landed yet), so no state is set
// synchronously inside effects and every view gets retry for free.
import { useEffect, useState } from "react";
import { opsApi, OpsApiError } from "./api";

interface Landed<T> {
  path: string;
  attempt: number;
  value: T | null;
  failed: boolean;
  status: number | null;
}

export interface OpsLoad<T> {
  loading: boolean;
  failed: boolean;
  /** HTTP status of the failure (null when it did not come from the API). */
  status: number | null;
  data: T | null;
  retry: () => void;
}

export function useOpsLoad<T>(path: string): OpsLoad<T> {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void opsApi<T>(path)
      .then((value) => {
        if (!cancelled) setLanded({ path, attempt, value, failed: false, status: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLanded({ path, attempt, value: null, failed: true, status: error instanceof OpsApiError ? error.status : null });
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const current = landed !== null && landed.path === path && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    status: current?.status ?? null,
    data: current && !current.failed ? current.value : null,
    retry: () => setAttempt((n) => n + 1),
  };
}
