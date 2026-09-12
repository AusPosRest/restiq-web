// Ends the kiosk's guest session on this tab (issue #214): clears both guest
// cookies so the next guest at the kiosk starts clean. Server-side the
// session simply idles out (~4h TTL) - there is no guest-side close
// endpoint and the kiosk order is already placed. Same cookie-clearing shape
// as pos/auth/logout.
import { NextResponse } from "next/server";
import { GUEST_DISPLAY_COOKIE, GUEST_SESSION_COOKIE } from "@/lib/guest-session";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  for (const name of [GUEST_SESSION_COOKIE, GUEST_DISPLAY_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return response;
}
