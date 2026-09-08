// Exchanges a staff PIN for a backend pos JWT and stores it in an httpOnly
// cookie - the token never reaches client-side JS, mirroring
// src/app/ops/auth/login/route.ts's credential-exchange shape (AD-13).
//
// Verified contract (restiq-backend's feature/44-pos-auth-clock branch -
// src/pos/auth/auth.dtos.ts, auth.controller.ts, auth.service.ts, read
// directly; not merged to restiq-backend/dev yet, but real, pushed, and this
// story's own backend counterpart):
//   POST /pos/v1/auth/login { tenantId, pin } ->
//     200 { status: "authenticated", token, staff: {id,name}, outlet: {id,name} }
//     200 { status: "select_outlet", pendingToken, staff: {id,name}, outlets: [{id,name}] }
//     401 { code: "invalid_pin", message }
//     409 { code: "no_outlets", message }
//     429 { code: "locked_out", message } (5 wrong attempts, keyed to tenant+pin)
//
// tenantId: PIN entry has no tenant-picker step ahead of it (SPEC/
// EXPERIENCE.md never describe one), so the client supplies it instead -
// terminal-binding.ts's localStorage binding, set when the terminal is
// opened via an enrolled device's `?device=&tenant=` link (issue #150). This
// route trusts whatever tenantId the client sends (validated only as a
// well-formed UUID) because it carries no more authority than the PIN itself
// does - the backend is the actual trust boundary, rejecting any
// tenantId/pin combination that doesn't resolve to a real staff member.
// POS_TENANT_ID (server-only env var - no .env.example exists in this repo
// yet, same as every other env var here) remains the fallback for a terminal
// opened with no binding (e.g. a bare /pos/login in dev).
import { NextResponse } from "next/server";
import { posLoginResponse } from "../session-cookies";
import type { PosLoginResult } from "../types";

const PIN_PATTERN = /^\d{4}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { pin, tenantId: requestedTenantId } = (body ?? {}) as { pin?: unknown; tenantId?: unknown };
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return errorResponse(400, { error: { code: "validation_failed", message: "A 4-digit PIN is required" } });
  }
  if (requestedTenantId !== undefined && (typeof requestedTenantId !== "string" || !UUID_PATTERN.test(requestedTenantId))) {
    return errorResponse(400, { error: { code: "validation_failed", message: "tenantId must be a UUID" } });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const tenantId = (requestedTenantId as string | undefined) ?? process.env.POS_TENANT_ID;
  if (!apiUrl || !tenantId) {
    return errorResponse(500, { error: { code: "misconfigured", message: "NEXT_PUBLIC_API_URL/POS_TENANT_ID is not set" } });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/pos/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, pin }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, { error: { code: "upstream_unreachable", message: "The API could not be reached" } });
  }

  if (!upstream.ok) {
    // Pass the backend's error through untouched - never elaborate on
    // whether the PIN belongs to anyone, same discipline as ops's login.
    const upstreamBody: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(upstreamBody ?? { error: { code: "error", message: "Sign-in failed" } }, { status: upstream.status });
  }

  const data = (await upstream.json()) as PosLoginResult;
  return posLoginResponse(data);
}
