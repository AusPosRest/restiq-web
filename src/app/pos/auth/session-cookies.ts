// Shared by both CAP-1 auth route handlers (login and select-outlet): turns
// a backend PosLoginResult into the response the client sees. Only the
// "authenticated" branch issues real cookies - "select_outlet" has no token
// yet, so nothing to store until the staff member picks an outlet and
// resubmits to select-outlet.
import { NextResponse } from "next/server";
import { POS_SESSION_COOKIE, POS_SESSION_MAX_AGE_SECONDS, POS_STAFF_COOKIE } from "@/lib/pos-session";
import type { PosLoginResult } from "./types";

export function posLoginResponse(result: PosLoginResult): NextResponse {
  if (result.status === "select_outlet") {
    return NextResponse.json(result);
  }

  const response = NextResponse.json({ status: result.status, staff: result.staff, outlet: result.outlet });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: POS_SESSION_MAX_AGE_SECONDS,
  };
  response.cookies.set(POS_SESSION_COOKIE, result.token, cookieOptions);
  response.cookies.set(POS_STAFF_COOKIE, JSON.stringify({ staff: result.staff, outlet: result.outlet }), cookieOptions);
  return response;
}
