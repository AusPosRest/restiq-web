// Sets a new owner password from the emailed token. Success is 204 from the backend (every older
// session is ended there); the owner then signs in with the new password, so no cookie is set here.
import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api-url";

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { token, password } = (body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof token !== "string" || typeof password !== "string" || !token || !password) {
    return errorResponse(400, "validation_failed", "token and password are required");
  }

  const url = apiUrl();
  if (!url) return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");

  let upstream: Response;
  try {
    upstream = await fetch(`${url}/admin/v1/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The API could not be reached");
  }
  if (upstream.status === 204) return NextResponse.json({ ok: true });
  // reset_invalid / reset_expired pass through: the form shows a specific, no-dead-end message.
  const upstreamBody: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(upstreamBody ?? { error: { code: "error", message: "Could not reset the password" } }, { status: upstream.status });
}
