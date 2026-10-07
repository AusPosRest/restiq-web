// Starts a kiosk session (issue #214): exchanges the enrolled kiosk device's
// id (plus its outlet) for a guest JWT - no name, phone or PIN - and stores
// it in the same httpOnly guest_session cookie the table flow uses, so every
// later guest screen (/qr/menu, /qr/cart, /qr/status) works unchanged.
// Backend contract: restiq-backend#138's POST /guest/v1/kiosk/sessions -
// see ../types.ts. Upstream errors pass through untouched (404 for a device
// that is not an active kiosk at this outlet, 403 kiosk_disabled) so the
// attract screen can show the backend's own message.
import { NextResponse } from "next/server";
import { guestSessionResponse } from "../session-cookies";
import type { GuestApiError, KioskStartResult } from "../types";

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { outletId, deviceId } = (body ?? {}) as Record<string, unknown>;
  if (typeof outletId !== "string" || !outletId || typeof deviceId !== "string" || !deviceId) {
    return errorResponse(400, "validation_failed", "outletId and deviceId are required");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/guest/v1/kiosk/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outletId, deviceId }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The kitchen could not be reached - please try again");
  }

  if (!upstream.ok) {
    const upstreamBody = (await upstream.json().catch(() => null)) as GuestApiError | null;
    return NextResponse.json(upstreamBody ?? { error: { code: "error", message: "Could not start your order" } }, { status: upstream.status });
  }

  const data = (await upstream.json()) as KioskStartResult;
  // No table and no shareable PIN on a kiosk - the display record keeps the
  // same shape so cart/checkout pages parse it unchanged.
  return guestSessionResponse(data.token, { outletId, tableId: "", guestName: "Kiosk", pin: "" });
}
