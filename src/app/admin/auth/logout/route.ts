import { apiUrl } from "@/lib/api-url";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_LOGIN_PATH, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { tokenIsServiceSession } from "@/lib/session-token";
import { tenantHostHeaders } from "@/lib/tenant-host-headers";

// restiq-web#342: POST /admin/v1/auth/logout ends the owner's sessions server-side (SE-9), so a copied
// cookie stops working too. Best effort - the cookie is cleared whatever the API says.
// restiq-web#449: a service-mode session must not end the owner's sessions (the API refuses it
// anyway), so it only drops the cookie and says so on the login page.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const service = token !== undefined && tokenIsServiceSession(token);
  const url = apiUrl();
  if (token && url && !service) {
    await fetch(`${url}/admin/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, ...tenantHostHeaders(request) },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined);
  }

  // Relative (SE-10): request.url is the server's internal origin, not the restaurant's address the browser is on.
  const location = service ? `${ADMIN_LOGIN_PATH}?service=ended` : ADMIN_LOGIN_PATH;
  const response = new NextResponse(null, { status: 303, headers: { location } });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
