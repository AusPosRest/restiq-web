// The app's single request interceptor (AD-4): auth scoping branches on the
// /ops path prefix. Tenant routes are untouched - the matcher never fires
// for them.
import { NextRequest, NextResponse } from "next/server";
import { decideOpsRoute, OPS_SESSION_COOKIE } from "@/lib/ops-session";

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(OPS_SESSION_COOKIE)?.value;
  const decision = decideOpsRoute(pathname, search, token);
  if (!decision.allow) {
    return NextResponse.redirect(new URL(decision.redirectTo, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/ops/:path*",
};
