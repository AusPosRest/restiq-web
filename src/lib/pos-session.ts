// POS session plumbing shared by the proxy and (once story 1/#38 lands) the
// /pos auth route handlers. Fourth disjoint auth realm per SPEC's AD-13 (aud:
// pos, own POS_JWT_SECRET) - mirrors admin-session.ts/ops-session.ts exactly.
//
// Story 1 (issue #38, "POS auth realm, PIN login, and clock in/out") owns
// PIN entry, outlet picking and actually issuing this cookie - at the time
// this story (#40, CAP-2 table map) was built, that story's branch existed
// but had no commits yet (verified via `git log`), so there is no /pos/login
// page to route to and no real POS_JWT_SECRET-signed token to test against a
// live backend. This file is still added now because table-map's own route
// guard needs it to exist in a real, secure form rather than being skipped -
// once story 1 lands its PIN-verify endpoint, it only needs to issue a token
// shaped like fakeToken() in pos-session.test.ts (a `sub` claim identifying
// the StaffUser) into this exact cookie name for every route below to work
// unchanged.
import { tokenIsExpired } from "./session-token";

export const POS_SESSION_COOKIE = "pos_session";
export const POS_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const POS_LOGIN_PATH = "/pos/login";
/** Reachable without a session: the PIN login screen story 1 adds here. */
const PUBLIC_POS_PATHS = new Set([POS_LOGIN_PATH]);

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
