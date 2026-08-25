// Second step of CAP-1 PIN login for multi-outlet tenants: exchanges the
// short-lived pendingToken the login route handed back (backend-signed,
// aud:"pos-pending", 5 minute TTL - restiq-backend's feature/44-pos-auth-clock,
// src/platform/pos-jwt.ts) plus the chosen outlet for the real pos session.
// Mirrors ../login/route.ts's cookie-issuing shape via session-cookies.ts.
import { NextResponse } from "next/server";
import { posLoginResponse } from "../session-cookies";
import type { PosLoginResult } from "../types";

function errorResponse(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { pendingToken, outletId } = (body ?? {}) as { pendingToken?: unknown; outletId?: unknown };
  if (typeof pendingToken !== "string" || !pendingToken) {
    return errorResponse(400, { error: { code: "validation_failed", message: "pendingToken is required" } });
  }
  if (typeof outletId !== "string" || !outletId) {
    return errorResponse(400, { error: { code: "validation_failed", message: "outletId is required" } });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return errorResponse(500, { error: { code: "misconfigured", message: "NEXT_PUBLIC_API_URL is not set" } });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/pos/v1/auth/select-outlet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingToken, outletId }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, { error: { code: "upstream_unreachable", message: "The API could not be reached" } });
  }

  if (!upstream.ok) {
    const upstreamBody: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(upstreamBody ?? { error: { code: "error", message: "Sign-in failed" } }, { status: upstream.status });
  }

  const data = (await upstream.json()) as PosLoginResult;
  return posLoginResponse(data);
}
