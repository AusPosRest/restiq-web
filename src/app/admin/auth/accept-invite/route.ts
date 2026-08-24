// Exchanges an invite token + new password for a backend admin JWT and
// stores it in an httpOnly cookie - the token never reaches client-side JS.
// The API base comes from the environment only (house rule: no hostnames in
// source).
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from "@/lib/admin-session";

interface AcceptInviteResponse {
  token: string;
}

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { token, password } = (body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof token !== "string" || typeof password !== "string" || !token || !password) {
    return errorResponse(400, "validation_failed", "token and password are required");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/admin/v1/auth/accept-invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The API could not be reached");
  }

  if (!upstream.ok) {
    // Pass the backend's error through untouched - it names invalid/expired
    // invites specifically, which the form relies on for the no-dead-end copy.
    const upstreamBody: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(
      upstreamBody ?? { error: { code: "error", message: "Could not accept the invite" } },
      { status: upstream.status },
    );
  }

  const data = (await upstream.json()) as AcceptInviteResponse;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
