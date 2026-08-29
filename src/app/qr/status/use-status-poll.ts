"use client";

// Live-polling loader for Q7's order status list (CAP-6) - same shape as
// cart/use-cart-poll.ts, at the same ~5s cadence EXPERIENCE.md's Foundation
// specifies for "anything shared (cart, status)". A successful poll always
// replaces `data` directly (EXPERIENCE.md "status polls update in place,
// never blank-and-repaint"); a failed one keeps the last-known list with a
// quiet staleness flag rather than blanking the screen; a 410 flips to
// sessionClosed and stops the interval, since a closed session's orders will
// never change again.
import { useEffect, useState } from "react";
import { GuestApiError } from "../api-client";
import { fetchSessionOrders, type GuestSessionOrdersView } from "./status-api";

export const STATUS_POLL_MS = 5_000;

export interface StatusPoll {
  loading: boolean;
  /** True only when the very first load failed and there's nothing to show at all. */
  failed: boolean;
  /** True once any poll (after a successful first load) has failed. */
  stale: boolean;
  /** True once the backend reports the session as closed (410 session_closed). */
  sessionClosed: boolean;
  data: GuestSessionOrdersView | null;
  retry: () => void;
}

export function useStatusPoll(): StatusPoll {
  const [data, setData] = useState<GuestSessionOrdersView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stale, setStale] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let closed = false;

    function poll(isFirstLoad: boolean) {
      fetchSessionOrders()
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
    }, STATUS_POLL_MS);
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
  };
}
