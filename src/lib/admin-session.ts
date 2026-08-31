// Admin session plumbing shared by the proxy and the /admin auth route
// handlers. Third disjoint auth realm per AD-10 (aud:admin) - no session is
// ever shared with /ops. The cookie carries the backend-issued admin JWT and
// is httpOnly - client code never reads it.

import { tokenIsExpired } from "./session-token";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const ADMIN_LOGIN_PATH = "/admin/login";
/** Reachable without a session: login, and accepting an owner invite. */
const PUBLIC_ADMIN_PATHS = new Set([ADMIN_LOGIN_PATH, "/admin/auth/accept-invite"]);
const INVITE_PATH = /^\/admin\/invite\/[^/]+$/;

function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.has(pathname) || INVITE_PATH.test(pathname);
}

/** Return-to targets must stay inside the tenant admin console - anything else is dropped. */
export function sanitizeAdminNextPath(next: string | undefined): string {
  if (next && /^\/admin(\/|$|\?)/.test(next)) return next;
  return "/admin";
}

export type AdminRouteDecision = { allow: true } | { allow: false; redirectTo: string };

/**
 * Routing decision for a request under the /admin prefix. Ops routes never
 * reach this - the proxy branches by prefix before calling in (AD-10).
 */
export function decideAdminRoute(pathname: string, search: string, sessionToken: string | undefined): AdminRouteDecision {
  if (isPublicAdminPath(pathname)) return { allow: true };

  if (sessionToken === undefined) {
    return { allow: false, redirectTo: `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}` };
  }
  if (tokenIsExpired(sessionToken)) {
    return {
      allow: false,
      redirectTo: `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}&expired=1`,
    };
  }
  return { allow: true };
}
