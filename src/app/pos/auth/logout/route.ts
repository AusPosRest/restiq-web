import { NextResponse, type NextRequest } from "next/server";
import { apiUrl } from "@/lib/api-url";
import { POS_SESSION_COOKIE, POS_STAFF_COOKIE } from "@/lib/pos-session";

// restiq-backend#169: POST /pos/v1/auth/logout ends this staff member's
// sessions server-side (it moves their session version on), so a token copied
// off this device stops working too. Best effort - the cookies are cleared
// whatever the API says, so Sign out always signs this device out.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(POS_SESSION_COOKIE)?.value;
  const url = apiUrl();
  if (token && url) {
    await fetch(`${url}/pos/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(POS_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(POS_STAFF_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
