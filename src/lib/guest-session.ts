// Guest session plumbing shared by the proxy and the /qr auth route handlers.
// Fifth disjoint auth realm per spec-qr-self-order/SPEC.md Constraints (aud:
// guest, own GUEST_JWT_SECRET) - mirrors admin-session.ts/ops-session.ts/
// pos-session.ts exactly, extending AD-4's pattern once more. Unlike the
// staff realms, guests never log in - the token is minted from starting or
// joining a table session (CAP-1), and the only "public" paths are the QR
// entry point itself (welcome + join/start), which stay reachable with or
// without a session so a returning guest can still see the welcome screen.
import { tokenIsExpired } from "./session-token";

export const GUEST_SESSION_COOKIE = "guest_session";
// TableSession is lifecycle-limited by settlement/staff-close plus a ~4h
// idle TTL backstop (SPEC Assumptions) - this cookie just shouldn't outlive
// whatever the backend's GUEST_JWT_SECRET token actually expires at.
export const GUEST_SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;

export interface GuestSessionDisplay {
  outletId: string;
  tableId: string;
  guestName: string;
  pin: string;
}

/** Parses the guest_display cookie value, or null for anything missing/malformed. */
export function parseGuestSessionDisplay(value: string | undefined): GuestSessionDisplay | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { outletId, tableId, guestName, pin } = parsed as Record<string, unknown>;
    if (
      typeof outletId !== "string" ||
      typeof tableId !== "string" ||
      typeof guestName !== "string" ||
      typeof pin !== "string"
    ) {
      return null;
    }
    return { outletId, tableId, guestName, pin };
  } catch {
    return null;
  }
}

export const GUEST_DISPLAY_COOKIE = "guest_display";

/**
 * Routing decision for a request under the /qr prefix. Other realms never
 * reach this - the proxy matcher is scoped to /qr (mirrors AD-4/AD-10/AD-13).
 * This story only ships the entry point (welcome + session PIN), which is
 * reachable by every guest regardless of session state - a session-gated
 * redirect only matters once later Q-screens (menu, cart, checkout, status)
 * land, so this stays a pass-through today with the same shape those
 * screens will need (expired-token redirect back to the table's welcome
 * page, never a dead end).
 */
export type GuestRouteDecision = { allow: true } | { allow: false; redirectTo: string };

export function decideGuestRoute(
  pathname: string,
  _search: string,
  sessionToken: string | undefined,
): GuestRouteDecision {
  void _search;
  // The QR entry surface (welcome/session-PIN screens and their auth route
  // handlers) is always reachable - it's how a session starts in the first
  // place, and a guest with an expired token must be able to land back here
  // to rejoin rather than hit a dead end.
  if (/^\/qr\/t\/[^/]+\/[^/]+(\/|$)/.test(pathname) || pathname.startsWith("/qr/auth/")) {
    return { allow: true };
  }
  // Nothing else exists under /qr yet in this story; once menu/cart/checkout/
  // status screens land, they gate on a live (non-expired) session token
  // here, same pattern as decidePosRoute.
  if (sessionToken === undefined || tokenIsExpired(sessionToken)) {
    return { allow: false, redirectTo: "/qr" };
  }
  return { allow: true };
}
