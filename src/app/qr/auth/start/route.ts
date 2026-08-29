// Starts a table session (CAP-1, first guest): exchanges name+phone for a
// guest JWT + shareable 4-digit PIN and stores the JWT in an httpOnly cookie
// - the token never reaches client-side JS, mirroring pos/auth/login's
// credential-exchange shape (AD-13, extended to the guest realm).
//
// Real contract (restiq-backend PR #69, merged - see ../types.ts): a second
// start on a table that already has one open 409s with `session_already_open`
// rather than an error the client should surface as a failure - welcome-
// flow.tsx reads that code and flips into join mode instead of showing it as
// a submission error, so this route passes the upstream body through
// untouched either way, same discipline as join's wrong-PIN passthrough.
import { NextResponse } from "next/server";
import { guestSessionResponse } from "../session-cookies";
import type { GuestApiError, GuestStartResult } from "../types";

const PHONE_PATTERN = /^\d{10}$/;

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { outletId, tableId, name, phone } = (body ?? {}) as Record<string, unknown>;

  if (typeof outletId !== "string" || !outletId || typeof tableId !== "string" || !tableId) {
    return errorResponse(400, "validation_failed", "outletId and tableId are required");
  }
  if (typeof name !== "string" || !name.trim()) {
    return errorResponse(400, "validation_failed", "Your name is required");
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) {
    return errorResponse(400, "validation_failed", "A 10-digit phone number is required");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/guest/v1/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outletId, tableId, name: name.trim(), phone }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The kitchen could not be reached - please try again");
  }

  if (!upstream.ok) {
    const upstreamBody = (await upstream.json().catch(() => null)) as GuestApiError | null;
    return NextResponse.json(
      upstreamBody ?? { error: { code: "error", message: "Could not start your table session" } },
      { status: upstream.status },
    );
  }

  const data = (await upstream.json()) as GuestStartResult;
  return guestSessionResponse(data.token, { outletId, tableId, guestName: name.trim(), pin: data.pin });
}
