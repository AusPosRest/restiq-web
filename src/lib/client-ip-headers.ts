// restiq-backend#171: sign-in throttling keys on the browser's address, but
// our own route handlers make the API call, so the API sees this server's
// address for everyone. Pass the browser's along, signed with the shared
// secret the API checks (restiq-backend src/platform/client-ip.ts). On Vercel,
// x-real-ip / x-forwarded-for are set by Vercel's edge, not the browser.
// No PROXY_SHARED_SECRET (local dev) -> no headers; the API uses its own view.
export function clientIpHeaders(request: Request): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET;
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!secret || !ip) return {};
  return { "x-restiq-client-ip": ip, "x-restiq-proxy-secret": secret };
}
