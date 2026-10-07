// Asks the backend to email an owner a password-reset link. The backend answers 202 whether or
// not the email is registered, and this passes that through untouched - the page must never be
// able to tell which emails have accounts.
import { NextResponse } from "next/server";
import { clientIpHeaders } from "@/lib/client-ip-headers";

function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const { email } = (body ?? {}) as { email?: unknown };
  if (typeof email !== "string" || !email.trim()) return errorResponse(400, "validation_failed", "email is required");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return errorResponse(500, "misconfigured", "NEXT_PUBLIC_API_URL is not set");

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/admin/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json", ...clientIpHeaders(request) },
      body: JSON.stringify({ email: email.trim() }),
      cache: "no-store",
    });
  } catch {
    return errorResponse(502, "upstream_unreachable", "The API could not be reached");
  }
  const upstreamBody: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(upstreamBody ?? { error: { code: "error", message: "Could not send the reset email" } }, { status: upstream.status });
}
