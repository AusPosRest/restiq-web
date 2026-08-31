// Shared cart-summary contract for CAP-2's floating CartPill (this story,
// issue #67) and CAP-3's shared Table Order review screen (issue #68, built
// concurrently against the same real cart endpoint). Both stories read the
// same `GET /guest/v1/cart` response (`TableCartView`, restiq-backend `dev`
// `src/guest/cart/cart.dtos.ts`, PR #74, read directly) - issue #68 should
// adopt `useCartSummary`/`summarizeCart`/`CartSummary` from here (or at
// minimum the `TableCartView` shape) rather than re-deriving a count/total
// from its own parallel copy, so the two stories can't disagree about what
// "the cart" holds. This file only surfaces a *summary* (count + total, no
// line-level or per-guest detail) - the full per-guest breakdown with
// `GuestChip` attribution (Q5) is issue #68's own build, out of scope here.
import { useCallback, useEffect, useRef, useState } from "react";

export interface TableCartLineView {
  quantity: number;
}

export interface TableCartGuestView {
  guestId: string;
  guestName: string;
  lines: TableCartLineView[];
  subtotalMinor: number;
}

export interface TableCartView {
  sessionId: string;
  guests: TableCartGuestView[];
  totalMinor: number;
  currency: string;
}

export interface CartSummary {
  /** Sum of every line's quantity, across every guest at the table. */
  count: number;
  totalMinor: number;
  currency: string;
}

// No tenant-wide default currency exists yet (menu-state.ts's own header
// note) - an empty/unreachable cart falls back to this, same India-first
// posture as the rest of the demo data.
export const EMPTY_CART_SUMMARY: CartSummary = { count: 0, totalMinor: 0, currency: "INR" };

export function summarizeCart(cart: TableCartView): CartSummary {
  const count = cart.guests.reduce((sum, guest) => sum + guest.lines.reduce((lineSum, line) => lineSum + line.quantity, 0), 0);
  return { count, totalMinor: cart.totalMinor, currency: cart.currency };
}

async function fetchCartSummary(): Promise<CartSummary | null> {
  let response: Response;
  try {
    response = await fetch("/qr/api/cart", { cache: "no-store" });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as { guests?: unknown }).guests)) return null;
  return summarizeCart(body as TableCartView);
}

// EXPERIENCE.md Foundation: "~5s polling for anything shared (cart, status)".
const POLL_MS = 5000;

/**
 * Polls the real shared cart and keeps the pill's count/total current.
 * EXPERIENCE.md's Error state pattern applies: "a failed poll keeps
 * last-known state with a quiet staleness note" - here that's simply
 * ignoring a failed poll and holding the previous summary, since the pill
 * itself carries no separate staleness UI (nothing in the Q3/Q4 mocks calls
 * for one). `refresh` lets a caller (e.g. after posting a new cart line)
 * force an immediate update instead of waiting for the next poll tick.
 */
export function useCartSummary(): { summary: CartSummary; refresh: () => Promise<void> } {
  const [summary, setSummary] = useState<CartSummary>(EMPTY_CART_SUMMARY);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const next = await fetchCartSummary();
    if (next && mounted.current) setSummary(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { summary, refresh };
}
