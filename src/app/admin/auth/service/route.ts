// restiq-web#449 service mode: the Platform Console POSTs a 60-second handoff code here, in a new
// tab on the restaurant's own address. The API swaps it for a 1-hour admin token (svc: true), which
// goes in the same httpOnly cookie an owner sign-in uses. The code and token are never echoed.
import { apiUrl } from "@/lib/api-url";
import { clientIpHeaders } from "@/lib/client-ip-headers";
import { tenantHostHeaders } from "@/lib/tenant-host-headers";
import { ADMIN_LOGIN_PATH, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { NextResponse } from "next/server";

const MAX_CODE_LENGTH = 2048;
const MAX_SESSION_SECONDS = 3600;

// Relative (SE-10): request.url is the server's internal origin, not the restaurant's address the browser is on.
function redirect(location: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { location } });
}

export async function POST(request: Request): Promise<NextResponse> {
  const expired = () => redirect(`${ADMIN_LOGIN_PATH}?service=expired`);

  const form = await request.formData().catch(() => null);
  const code = form?.get("code");
  if (typeof code !== "string" || !code || code.length > MAX_CODE_LENGTH) return expired();

  const url = apiUrl();
  if (!url) return expired();

  let body: unknown;
  try {
    const upstream = await fetch(`${url}/admin/v1/auth/service-session`, {
      method: "POST",
      headers: { "content-type": "application/json", ...tenantHostHeaders(request), ...clientIpHeaders(request) },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
    if (!upstream.ok) return expired();
    body = await upstream.json();
  } catch {
    return expired();
  }

  const { token, expiresInSeconds } = (body ?? {}) as { token?: unknown; expiresInSeconds?: unknown };
  if (typeof token !== "string" || !token) return expired();
  const maxAge = typeof expiresInSeconds === "number" && expiresInSeconds > 0 ? Math.min(Math.floor(expiresInSeconds), MAX_SESSION_SECONDS) : MAX_SESSION_SECONDS;

  const response = redirect("/admin");
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}
