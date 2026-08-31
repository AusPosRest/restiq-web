// Server-side pass-through to the backend's /admin/v1 API. The admin JWT
// lives in an httpOnly cookie (never readable client-side), so browser code
// calls /admin/api/* and this handler attaches the Authorization header. The
// backend guard remains the enforcement point - this adds a credential, not
// authz.
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

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

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: { code: "unauthorized", message: "A valid owner session is required" } }, { status: 401 });
  }

  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      // Menu import's file upload: forward the original content-type (its
      // boundary is part of the value) and the raw bytes - decoding as text
      // would corrupt binary files.
      headers["content-type"] = contentType;
      init.body = await request.arrayBuffer();
    } else {
      headers["content-type"] = "application/json";
      init.body = await request.text();
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/admin/v1/${path.join("/")}${request.nextUrl.search}`, init);
  } catch {
    return NextResponse.json({ error: { code: "upstream_unreachable", message: "The API could not be reached" } }, { status: 502 });
  }

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  // CAP-9's report exports return a raw text/csv body (with a
  // Content-Disposition filename), not a JSON envelope - forwarding those
  // through upstream.json() would silently corrupt them. Any non-JSON
  // upstream response is passed through as bytes with its content-type and
  // content-disposition intact instead.
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const bytes = await upstream.arrayBuffer();
    const headers: Record<string, string> = { "content-type": contentType || "application/octet-stream" };
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers["content-disposition"] = disposition;
    return new NextResponse(bytes, { status: upstream.status, headers });
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
export function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
export function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
export function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  return forward(request, ctx.params);
}
