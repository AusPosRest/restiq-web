import { cookies } from "next/headers";
import { GUEST_DISPLAY_COOKIE, parseGuestSessionDisplay } from "@/lib/guest-session";
import { CartScreen } from "./cart-screen";

// Flat, session-gated route (decideGuestRoute's default branch - see
// src/lib/guest-session.ts - already redirects here-or-anywhere-under-/qr to
// /qr when the guest_session token is missing/expired, so this page can
// assume a live session by the time it renders). Reads guestId from the
// guest_display cookie server-side (same pattern as pos/(shell)/layout.tsx
// reading pos_staff) rather than a backend /me lookup - the JWT already
// carried it at start/join time (session-cookies.ts), so this costs no
// invented endpoint.
export default async function CartPage() {
  const cookieStore = await cookies();
  const display = parseGuestSessionDisplay(cookieStore.get(GUEST_DISPLAY_COOKIE)?.value);
  return <CartScreen myGuestId={display?.guestId ?? ""} />;
}
