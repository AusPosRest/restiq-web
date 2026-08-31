// Server-side pass-through to the backend's /pos/v1 API. The pos JWT lives in
// an httpOnly cookie (never readable client-side), so browser code calls
// /pos/api/* and this handler attaches the Authorization header. The backend
// guard remains the enforcement point - this adds a credential, not authz.
// Mirrors src/app/admin/api/[...path]/route.ts (AD-4/AD-13). No multipart
// handling: unlike admin's menu-import upload, nothing under /pos/v1 takes a
// file body.
import { NextRequest, NextResponse } from "next/server";
import { POS_SESSION_COOKIE } from "@/lib/pos-session";

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

  const token = request.cookies.get(POS_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: { code: "unauthorized", message: "A valid POS session is required" } }, { status: 401 });
  }

  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    headers["content-type"] = "application/json";
    init.body = await request.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/pos/v1/${path.join("/")}${request.nextUrl.search}`, init);
  } catch {
    return NextResponse.json({ error: { code: "upstream_unreachable", message: "The API could not be reached" } }, { status: 502 });
  }

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

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
