// The app's single request interceptor (AD-4/AD-10/AD-13): auth scoping
// branches on the /ops, /admin, /pos and /qr path prefixes, each its own
// disjoint realm with its own session cookie. Tenant routes are untouched -
// the matcher never fires for them. /qr is the fifth realm (guest, spec-
// qr-self-order SPEC.md Constraints) and the first whose principals aren't
// staff.
import { NextRequest, NextResponse } from "next/server";
import { decideAdminRoute, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { decideGuestRoute, GUEST_SESSION_COOKIE } from "@/lib/guest-session";
import { decideOpsRoute, OPS_SESSION_COOKIE } from "@/lib/ops-session";
import { decidePosRoute, POS_SESSION_COOKIE } from "@/lib/pos-session";

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const decision = pathname.startsWith("/admin")
    ? decideAdminRoute(pathname, search, request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
    : pathname.startsWith("/pos")
      ? decidePosRoute(pathname, search, request.cookies.get(POS_SESSION_COOKIE)?.value)
      : pathname.startsWith("/qr")
        ? decideGuestRoute(pathname, search, request.cookies.get(GUEST_SESSION_COOKIE)?.value)
        : decideOpsRoute(pathname, search, request.cookies.get(OPS_SESSION_COOKIE)?.value);

  if (!decision.allow) {
    return NextResponse.redirect(new URL(decision.redirectTo, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/ops/:path*", "/admin/:path*", "/pos/:path*", "/qr/:path*"],
};
