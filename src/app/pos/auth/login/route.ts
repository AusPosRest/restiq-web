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
// EXPERIENCE.md never describe one) and a pos session isn't device-bound
// (AD-13), so nothing in this prototype's UI ever learns which tenant a
// terminal belongs to - flagged as an open question for real multi-tenant
// terminal provisioning in wiki/features/pos-cashier-waiter.md's Key
// decisions. POS_TENANT_ID (server-only env var - no .env.example exists in
// this repo yet, same as every other env var here) is the concrete stand-in
// for now: one terminal deployment == one tenant, same posture as
// NEXT_PUBLIC_API_URL.
import { NextResponse } from "next/server";
import { posLoginResponse } from "../session-cookies";
import type { PosLoginResult } from "../types";

const PIN_PATTERN = /^\d{4}$/;

function errorResponse(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { pin } = (body ?? {}) as { pin?: unknown };
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return errorResponse(400, { error: { code: "validation_failed", message: "A 4-digit PIN is required" } });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const tenantId = process.env.POS_TENANT_ID;
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
