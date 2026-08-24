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
