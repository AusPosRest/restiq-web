import { NextRequest, NextResponse } from "next/server";
import { OPS_SESSION_COOKIE } from "@/lib/ops-session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(OPS_SESSION_COOKIE)?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Best-effort: the backend writes the logout audit row; clearing the cookie
  // must succeed even if the API is briefly unreachable.
  if (token && apiUrl) {
    await fetch(`${apiUrl}/ops/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(OPS_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
