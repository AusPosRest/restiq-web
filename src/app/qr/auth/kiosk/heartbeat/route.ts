// Kiosk heartbeat (issue #389): a kiosk tab has no staff session, so it
// reports in through this public route instead of the till's. Forwards
// outlet + device to restiq-backend#322's POST /guest/v1/kiosk/heartbeat and
// answers with the backend's own status: 204 alive, 404 not_found when the
// device is not an active kiosk at that outlet (removed by the owner).
import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api-url";
import type { GuestApiError } from "../../types";

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { outletId, deviceId } = (body ?? {}) as Record<string, unknown>;
  if (typeof outletId !== "string" || !outletId || typeof deviceId !== "string" || !deviceId) {
    return errorResponse(400, "validation_failed", "outletId and deviceId are required");
  }

  const url = apiUrl();
  if (!url) {
    return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${url}/guest/v1/kiosk/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outletId, deviceId }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The restaurant could not be reached");
  }

  if (!upstream.ok) {
    const upstreamBody = (await upstream.json().catch(() => null)) as GuestApiError | null;
    return NextResponse.json(upstreamBody ?? { error: { code: "error", message: "Heartbeat failed" } }, { status: upstream.status });
  }
  return new NextResponse(null, { status: 204 });
}
