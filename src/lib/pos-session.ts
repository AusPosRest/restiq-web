// POS session plumbing shared by the proxy and the /pos auth route handlers.
// Fourth disjoint auth realm per SPEC's AD-13 (aud: pos, own POS_JWT_SECRET)
// - mirrors admin-session.ts/ops-session.ts exactly. Story 3 (issue #40,
// table-map) added this file first with a real-shaped but self-authored
// login flow, since story 1 (issue #38, PIN login) hadn't landed yet at the
// time. Story 1 now delivers the real login/select-outlet route handlers
// that issue this cookie - see src/app/pos/auth/login/route.ts.
import { tokenIsExpired } from "./session-token";

export const POS_SESSION_COOKIE = "pos_session";
// Matches restiq-backend's real POS_SESSION_TTL_SECONDS (feature/44-pos-auth-clock,
// src/platform/pos-jwt.ts) - the JWT itself expires at 12h regardless of this
// cookie's maxAge, so this just keeps the cookie from outliving the token.
export const POS_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

// Non-sensitive display info (staff/outlet name) set alongside the session
// cookie so the post-login shell can render the shift bar without a backend
// session-read endpoint - restiq-backend's real contract has no `/pos/v1/
// auth/me` (only login, select-outlet, and clock/out), so this is the
// concrete stand-in: exactly what the login response said, never a fetch
// from thin air. httpOnly like the session cookie (no client JS needs it -
// the shell layout reads it server-side).
export const POS_STAFF_COOKIE = "pos_staff";

export interface PosStaffDisplay {
  staff: { id: string; name: string };
  outlet: { id: string; name: string };
}

/** Parses the pos_staff cookie value, or null for anything missing/malformed. */
export function parsePosStaffDisplay(value: string | undefined): PosStaffDisplay | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { staff, outlet } = parsed as Record<string, unknown>;
    const staffOk = typeof staff === "object" && staff !== null && typeof (staff as { id?: unknown }).id === "string" && typeof (staff as { name?: unknown }).name === "string";
    const outletOk = typeof outlet === "object" && outlet !== null && typeof (outlet as { id?: unknown }).id === "string" && typeof (outlet as { name?: unknown }).name === "string";
    if (!staffOk || !outletOk) return null;
    return parsed as PosStaffDisplay;
  } catch {
    return null;
  }
}

export const POS_LOGIN_PATH = "/pos/login";
/** Reachable without a session: the login page and its two route handlers (PIN verify, outlet select). */
const PUBLIC_POS_PATHS = new Set([POS_LOGIN_PATH, "/pos/auth/login", "/pos/auth/select-outlet"]);

/** Return-to targets must stay inside the POS surface - anything else is dropped. */
export function sanitizePosNextPath(next: string | undefined): string {
  if (next && /^\/pos(\/|$|\?)/.test(next)) return next;
  return "/pos";
}

export type PosRouteDecision = { allow: true } | { allow: false; redirectTo: string };

/**
 * Routing decision for a request under the /pos prefix. Other realms never
 * reach this - the proxy matcher is scoped to /pos (mirrors AD-4/AD-10).
 */
export function decidePosRoute(pathname: string, search: string, sessionToken: string | undefined): PosRouteDecision {
  if (PUBLIC_POS_PATHS.has(pathname)) return { allow: true };

  if (sessionToken === undefined) {
    return { allow: false, redirectTo: `${POS_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}` };
  }
  if (tokenIsExpired(sessionToken)) {
    return {
      allow: false,
      redirectTo: `${POS_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}&expired=1`,
    };
  }
  return { allow: true };
}
