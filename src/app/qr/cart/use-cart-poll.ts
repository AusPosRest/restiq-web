"use client";

// Live-polling loader for Q5's shared cart (CAP-3, stories.yaml story 3:
// "poll cadence consistent with the surface's other screens (~5s)").
// Unlike ops's useLiveSyncHealth (which gates a background update behind a
// "N updates - refresh" chip so it never yanks state out from under an
// operator's cursor), EXPERIENCE.md is explicit for this screen: "shared-
// cart and status polls update in place, never blank-and-repaint" - every
// guest's phone should just converge. So a successful poll always replaces
// `data` directly, and a failed one keeps the last-known state with a quiet
// staleness flag (EXPERIENCE.md "Error" state pattern) rather than blanking
// the screen.
import { useEffect, useState } from "react";
import { GuestApiError } from "../api-client";
import { fetchCart, type TableCartView } from "./cart-api";

export const CART_POLL_MS = 5_000;

export interface CartPoll {
  loading: boolean;
  /** True only when the very first load failed and there's nothing to show at all. */
  failed: boolean;
  /** True once any poll (after a successful first load) has failed - EXPERIENCE.md's "quiet staleness note". */
  stale: boolean;
  /** True once the backend reports the session as closed (410 session_closed) - every phone converges here, not an error. */
  sessionClosed: boolean;
  data: TableCartView | null;
  retry: () => void;
  /** Lets an own-line mutation (quantity/remove) push its response straight in, rather than waiting up to CART_POLL_MS for the next poll to show it. */
  applyUpdate: (next: TableCartView) => void;
}

export function useCartPoll(): CartPoll {
  const [data, setData] = useState<TableCartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stale, setStale] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Once the session closes, every further poll would just 410 again -
    // stop hitting the API rather than polling a dead session forever.
    let closed = false;

    function poll(isFirstLoad: boolean) {
      fetchCart()
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setFailed(false);
          setStale(false);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (error instanceof GuestApiError && error.status === 410) {
            closed = true;
            clearInterval(id);
            setSessionClosed(true);
            setLoading(false);
            return;
          }
          if (isFirstLoad) setFailed(true);
          else setStale(true);
          setLoading(false);
        });
    }

    poll(true);
    const id = setInterval(() => {
      if (!closed) poll(false);
    }, CART_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [attempt]);

  return {
    loading,
    failed,
    stale,
    sessionClosed,
    data,
    retry: () => {
      setLoading(true);
      setFailed(false);
      setAttempt((n) => n + 1);
    },
    applyUpdate: setData,
  };
}
