"use client";

import { useEffect, useState } from "react";
import { getCurrentShift } from "../../api";

/**
 * restiq-web#341 (PE-17): whether this outlet has an open shift, so the till
 * can ask for one before it takes cash. `false` only once the server has
 * said there is none; `null` while loading or if the check failed (the
 * server refuses cash without a shift either way).
 */
export function useShiftOpen(outletId: string): boolean | null {
  const [landed, setLanded] = useState<{ outletId: string; open: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentShift(outletId)
      .then((shift) => {
        if (!cancelled) setLanded({ outletId, open: shift !== null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [outletId]);

  return landed?.outletId === outletId ? landed.open : null;
}
