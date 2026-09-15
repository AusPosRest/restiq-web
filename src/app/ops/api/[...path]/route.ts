// Server-side pass-through to the backend's /ops/v1 API. The ops JWT lives in
// an httpOnly cookie (never readable client-side), so browser code calls
// /ops/api/* and this handler attaches the Authorization header. The backend
// guard remains the enforcement point - this adds a credential, not authz.
import { NextRequest, NextResponse } from "next/server";
import { OPS_SESSION_COOKIE } from "@/lib/ops-session";

const SEGMENT = /^[a-z0-9_-]+$/i;

async function forward(request: NextRequest, params: Promise<{ path: string[] }>): Promise<NextResponse> {
  const { path } = await params;
  if (!path.length || !path.every((segment) => SEGMENT.test(segment))) {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown API path" } }, { status: 404 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ error: { code: "misconfigured", message: "NEXT_PUBLIC_API_URL is not set" } }, { status: 500 });
  }

  const token = request.cookies.get(OPS_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: { code: "unauthorized", message: "A valid operator session is required" } }, { status: 401 });
  }

  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    headers["content-type"] = "application/json";
    init.body = await request.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/ops/v1/${path.join("/")}${request.nextUrl.search}`, init);
  } catch {
    return NextResponse.json({ error: { code: "upstream_unreachable", message: "The API could not be reached" } }, { status: 502 });
  }

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  // Signed agreement PDFs (#238) are raw bytes, not a JSON envelope: pass any
  // non-JSON response through untouched with its content-type and
  // content-disposition, same as the admin proxy does for CSV exports.
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const bytes = await upstream.arrayBuffer();
    const passthrough: Record<string, string> = { "content-type": contentType || "application/octet-stream" };
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) passthrough["content-disposition"] = disposition;
    return new NextResponse(bytes, { status: upstream.status, headers: passthrough });
  }

  const body: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(body ?? { error: { code: "error", message: "Unexpected API response" } }, { status: upstream.status });
}

export function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
export function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
export function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
export function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
