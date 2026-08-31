// Shared JWT expiry check for the proxy's route decisions (AD-4, AD-10). The
// proxy only decides routing - verifying the signature is the backend guard's
// job - so decoding (not verifying) the token here is fine for every realm.

export function tokenIsExpired(token: string): boolean {
  try {
    const [, payload] = token.split(".");
    if (!payload) return true;
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof decoded !== "object" || decoded === null) return true;
    const exp = (decoded as { exp?: unknown }).exp;
    return typeof exp !== "number" || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Decodes (does not verify) a JWT's `sub` claim - the guest realm's token
 * carries the guest's own id there (restiq-backend's signGuestToken, `sub:
 * principal.id`) and nowhere else in its payload. Used only to stamp the
 * guest_display cookie with "who am I" for CAP-3's own-line-editable check;
 * the backend guard is the real authority on identity for every write.
 */
export function decodeTokenSubject(token: string): string | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof decoded !== "object" || decoded === null) return null;
    const sub = (decoded as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}
