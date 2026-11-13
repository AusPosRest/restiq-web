// A session cookie is `secure` only when the browser reached us over https.
// A shop-LAN hub serves the till over plain http (HUB-BUILD-PLAN W1, D-4), and
// a secure cookie would never be sent back there, so sign-in would loop.
// x-forwarded-proto covers a TLS-terminating proxy in front of the server.
export function isHttpsRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}
