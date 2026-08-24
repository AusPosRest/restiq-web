// Ops session plumbing shared by the proxy and the /ops auth route handlers.
// The cookie carries the backend-issued ops JWT and is httpOnly - client code
// never reads it. Enforcement lives in the backend's /ops guard; the proxy
// only decides routing, so decoding (not verifying) the token here is fine.

export const OPS_SESSION_COOKIE = 'ops_session'
export const OPS_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

export const OPS_LOGIN_PATH = '/ops/login'
/** Reachable without a session: the login page and the login route handler. */
const PUBLIC_OPS_PATHS = new Set([OPS_LOGIN_PATH, '/ops/auth/login'])

/** Return-to targets must stay inside the console - anything else is dropped. */
export function sanitizeNextPath(next: string | undefined): string {
  if (next && /^\/ops(\/|$|\?)/.test(next)) return next
  return '/ops'
}

function tokenIsExpired(token: string): boolean {
  try {
    const [, payload] = token.split('.')
    if (!payload) return true
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof decoded !== 'object' || decoded === null) return true
    const exp = (decoded as { exp?: unknown }).exp
    return typeof exp !== 'number' || exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

export type OpsRouteDecision = { allow: true } | { allow: false; redirectTo: string }

/**
 * Routing decision for a request under the /ops prefix. Tenant routes never
 * reach this - the proxy matcher is scoped to /ops (AD-4).
 */
export function decideOpsRoute(pathname: string, search: string, sessionToken: string | undefined): OpsRouteDecision {
  if (PUBLIC_OPS_PATHS.has(pathname)) return { allow: true }

  if (sessionToken === undefined) {
    return { allow: false, redirectTo: `${OPS_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}` }
  }
  if (tokenIsExpired(sessionToken)) {
    return {
      allow: false,
      redirectTo: `${OPS_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}&expired=1`,
    }
  }
  return { allow: true }
}
