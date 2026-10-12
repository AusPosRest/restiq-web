// restiq-backend D14: a restaurant lives at <slug>.<base domain>, but browsers talk to this web server
// and this server talks to the API, so the API never sees that address. Forward it, signed with the
// shared secret the API checks (restiq-backend src/platform/tenant-address.service.ts); the API then
// refuses a token that belongs to a different restaurant. No PROXY_SHARED_SECRET (local dev) -> no
// headers and no check.
export function tenantHostHeaders(request: Request): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]?.trim();
  if (!secret || !host) return {};
  return { "x-restiq-tenant-host": host, "x-restiq-proxy-secret": secret };
}
