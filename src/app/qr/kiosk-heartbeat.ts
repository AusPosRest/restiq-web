"use client";

// Kiosk heartbeat (issue #389): a kiosk tab reports in every HEARTBEAT_MS
// (the till's cadence) through the public /qr/auth/kiosk/heartbeat, so the
// owner's Devices page sees it online. Mounted by KioskStart on the attract
// screen and by KioskChrome on the ordering screens - never both at once.
import { useEffect, useState } from "react";
import type { GuestApiError } from "./auth/types";

// The till's cadence (pos/device-heartbeat.tsx). Its own constant, so the guest pages don't import POS code.
export const HEARTBEAT_MS = 30_000;

/**
 * Beats while both ids are known. Returns true once the backend answers 404
 * `not_found` (not an active kiosk at that outlet - removed by the owner),
 * false again on a later 204. Network errors, 5xx and 400 keep the last
 * definite answer. An older backend without the endpoint answers its
 * unknown-route 404 with code "error" (ApiErrorFilter), so it never reads as removed.
 */
export function useKioskHeartbeat(outletId: string | null, deviceId: string | null): boolean {
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!outletId || !deviceId) return;
    let live = true;
    async function beat() {
      try {
        const response = await fetch("/qr/auth/kiosk/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outletId, deviceId }),
        });
        if (response.status === 204) {
          if (live) setRemoved(false);
        } else if (response.status === 404) {
          const body = (await response.json().catch(() => null)) as GuestApiError | null;
          if (live && body?.error?.code === "not_found") setRemoved(true);
        }
      } catch {
        // Offline - keep the last answer; the next beat tries again.
      }
    }
    void beat();
    const id = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [outletId, deviceId]);

  return removed;
}
