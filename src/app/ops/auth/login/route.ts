// Exchanges operator credentials for a backend ops JWT and stores it in an
// httpOnly cookie - the token never reaches client-side JS. The API base
// comes from the environment only (house rule: no hostnames in source).
import { NextResponse } from "next/server";
import { OPS_SESSION_COOKIE, OPS_SESSION_MAX_AGE_SECONDS } from "@/lib/ops-session";

interface LoginResponse {
  token: string;
  operator: { id: string; email: string };
}

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return errorResponse(400, "validation_failed", "email and password are required");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/ops/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The API could not be reached");
  }

  if (!upstream.ok) {
    // Pass the backend's generic error through untouched - never elaborate on
    // which credential was wrong.
    const upstreamBody: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(
      upstreamBody ?? { error: { code: "error", message: "Sign-in failed" } },
      { status: upstream.status },
    );
  }

  const data = (await upstream.json()) as LoginResponse;
  const response = NextResponse.json({ operator: data.operator });
  response.cookies.set(OPS_SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OPS_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
