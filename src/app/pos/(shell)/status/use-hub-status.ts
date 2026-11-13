"use client";

// Polls the shop hub's status every 10 s (HUB-BUILD-PLAN W2). null means "not
// on a hub": the cloud answers 404, polling stops, and the till keeps its
// browser-only connectivity pill. Any other failure keeps the last answer.
import { useEffect, useState } from "react";
import { getHubStatus, PosApiError, type HubStatus } from "../../api";

export const HUB_POLL_MS = 10_000;

export function useHubStatus(): HubStatus | null {
  const [status, setStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(): Promise<void> {
      try {
        const next = await getHubStatus();
        if (!stopped) setStatus(next);
      } catch (error) {
        if (error instanceof PosApiError && error.status === 404) return;
      }
      if (!stopped) timer = setTimeout(() => void poll(), HUB_POLL_MS);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return status;
}
