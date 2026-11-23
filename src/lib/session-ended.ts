// restiq-web#371: when a session is over - expired, revoked by the owner, signed out elsewhere -
// the browser goes to that console's sign-in page, with the page to come back to and the
// "session expired" notice. Called from the one place each console makes its requests (posApi,
// kdsApi, adminApi, opsApi), so every screen and poll gets it. Before this the kitchen display
// said "Reconnecting" forever and the consoles showed "couldn't be loaded".
//
// A session ends in two ways the caller can see:
//  - the API answers 401 with one of the auth guards' two codes. Other 401s (a wrong manager PIN,
//    a wrong password, a bad handoff code) are not the session ending and must sign nobody out;
//  - the cookie itself has expired, so src/proxy.ts redirects the request to the sign-in page and
//    fetch follows it: a 200 full of HTML, which the callers used to read as an empty answer.

const SESSION_ENDED_CODES = new Set(["unauthorized", "session_revoked"]);

export const SESSION_ENDED_MESSAGE = "This session has ended - sign in again";

/** True when it sent the browser to sign-in: the caller should stop and not use the response. */
export function leaveIfSessionEnded(res: Pick<Response, "status" | "redirected" | "url">, body: unknown, loginPath: string): boolean {
  if (typeof window === "undefined") return false;
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  const refused = res.status === 401 && typeof code === "string" && SESSION_ENDED_CODES.has(code);
  const sentToSignIn = res.redirected && new URL(res.url, window.location.href).pathname === loginPath;
  if (!refused && !sentToSignIn) return false;
  const { pathname, search } = window.location;
  if (pathname === loginPath) return false;
  // A full navigation, on purpose: this runs outside React (no router), and nothing held in memory should outlive the session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${loginPath}?next=${encodeURIComponent(pathname + search)}&expired=1`);
  return true;
}
