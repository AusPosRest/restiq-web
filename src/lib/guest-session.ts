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
  // The signed-in guest's own id (JWT `sub`, stamped in by guestSessionResponse
  // - see session-cookies.ts). CAP-3's shared cart needs it to tell "my line"
  // from everyone else's without a second round trip or a backend /me lookup.
  guestId: string;
}

/** Parses the guest_display cookie value, or null for anything missing/malformed. */
export function parseGuestSessionDisplay(value: string | undefined): GuestSessionDisplay | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { outletId, tableId, guestName, pin, guestId } = parsed as Record<string, unknown>;
    if (
      typeof outletId !== "string" ||
      typeof tableId !== "string" ||
      typeof guestName !== "string" ||
      typeof pin !== "string" ||
      typeof guestId !== "string"
    ) {
      return null;
    }
    return { outletId, tableId, guestName, pin, guestId };
  } catch {
    return null;
  }
}

export const GUEST_DISPLAY_COOKIE = "guest_display";

/**
 * Routing decision for a request under the /qr prefix. Other realms never
 * reach this - the proxy matcher is scoped to /qr (mirrors AD-4/AD-10/AD-13).
 *
 * The table entry point itself (welcome + session PIN, `/qr/t/{o}/{t}` with
 * no further segments) is reachable by every guest regardless of session
 * state - it's how a session starts in the first place. Later guest screens
 * are flat routes under `/qr` (`/qr/menu`, `/qr/cart`, etc.) and require a
 * live, non-expired session token.
 */
export type GuestRouteDecision = { allow: true } | { allow: false; redirectTo: string };

export function decideGuestRoute(
  pathname: string,
  _search: string,
  sessionToken: string | undefined,
): GuestRouteDecision {
  void _search;
  // The QR entry surface itself (welcome/session-PIN, exactly
  // /qr/t/:outletId/:tableId with no further segment) is always reachable -
  // it's how a session starts in the first place, and a guest with an
  // expired token must be able to land back here to rejoin rather than hit a
  // dead end. Anchored at the end (no trailing path allowed) - CAP-3 found
  // that an unanchored version of this regex would also match anything
  // *nested* under the entry point (e.g. /qr/t/o1/t1/cart), which would have
  // left every later Q-screen unintentionally reachable with no session at
  // all if it were ever routed that way. Later screens are flat gated paths
  // instead (/qr/cart, matching this function's own pre-existing test
  // literal /qr/menu) precisely so they fall through to the session check
  // below rather than needing to dodge this regex.
  if (/^\/qr\/t\/[^/]+\/[^/]+\/?$/.test(pathname) || pathname.startsWith("/qr/auth/")) {
    return { allow: true };
  }
  // Every other /qr/* path (menu/cart/checkout/status) gates on a live
  // (non-expired) session token, same pattern as decidePosRoute.
  if (sessionToken === undefined || tokenIsExpired(sessionToken)) {
    return { allow: false, redirectTo: "/qr" };
  }
  return { allow: true };
}
