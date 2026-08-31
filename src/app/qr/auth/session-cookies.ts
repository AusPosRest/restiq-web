// Shared by both CAP-1 auth route handlers (start and join): stores the
// guest JWT and a small non-sensitive display record (outlet/table/name/PIN)
// so the Session PIN screen can render "share this PIN" without a backend
// session-read endpoint - mirrors pos/auth/session-cookies.ts's
// pos_staff-cookie pattern exactly.
import { NextResponse } from "next/server";
import {
  GUEST_DISPLAY_COOKIE,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_MAX_AGE_SECONDS,
  type GuestSessionDisplay,
} from "@/lib/guest-session";
import { decodeTokenSubject } from "@/lib/session-token";

// `display` omits guestId - it's derived here from the token's own `sub`
// claim (decodeTokenSubject) rather than threaded through both start.ts and
// join.ts call sites, since the token already carries it and this is the one
// place both routes funnel through.
export function guestSessionResponse(token: string, display: Omit<GuestSessionDisplay, "guestId">): NextResponse {
  const guestId = decodeTokenSubject(token) ?? "";
  const response = NextResponse.json({ pin: display.pin });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
  };
  response.cookies.set(GUEST_SESSION_COOKIE, token, cookieOptions);
  response.cookies.set(GUEST_DISPLAY_COOKIE, JSON.stringify({ ...display, guestId }), cookieOptions);
  return response;
}
