// Joins an already-open table session (CAP-1, later guests): exchanges a
// 4-digit PIN + name for a guest JWT, storing it the same way start does.
// The PIN gates joining a cart, not money, so this is rate-limited but not
// credential-grade (SPEC Constraints) - a wrong PIN gets a plain inline
// error, never a lockout with drama.
//
// Contract assumed from SPEC.md pending reconciliation - see ../types.ts.
import { NextResponse } from "next/server";
import { guestSessionResponse } from "../session-cookies";
import type { GuestApiError, GuestJoinResult } from "../types";

const PIN_PATTERN = /^\d{4}$/;

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { outletId, tableId, pin, name } = (body ?? {}) as Record<string, unknown>;

  if (typeof outletId !== "string" || !outletId || typeof tableId !== "string" || !tableId) {
    return errorResponse(400, "validation_failed", "outletId and tableId are required");
  }
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return errorResponse(400, "validation_failed", "A 4-digit PIN is required");
  }
  if (typeof name !== "string" || !name.trim()) {
    return errorResponse(400, "validation_failed", "Your name is required");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/guest/v1/sessions/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outletId, tableId, pin, name: name.trim() }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The kitchen could not be reached - please try again");
  }

  if (!upstream.ok) {
    // Pass the backend's error through untouched, same discipline as pos's
    // login route - never elaborate on why a PIN was wrong.
    const upstreamBody = (await upstream.json().catch(() => null)) as GuestApiError | null;
    return NextResponse.json(
      upstreamBody ?? { error: { code: "error", message: "That PIN didn't match - ask your table for the 4-digit code" } },
      { status: upstream.status },
    );
  }

  const data = (await upstream.json()) as GuestJoinResult;
  return guestSessionResponse(data.token, { outletId, tableId, guestName: name.trim(), pin });
}
