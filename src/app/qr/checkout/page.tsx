import { cookies } from "next/headers";
import { GUEST_DISPLAY_COOKIE, parseGuestSessionDisplay } from "@/lib/guest-session";
import { CheckoutScreen } from "./checkout-screen";

// Q6 Checkout (CAP-5) - flat, session-gated route (decideGuestRoute's
// default branch already anticipated "/qr/checkout" by name - see
// src/lib/guest-session.ts's own comment - so no proxy/gating change was
// needed for this story). `orderId` arrives as a query param from this
// story's two entry points (status-screen.tsx's per-order "Request bill",
// cart-screen.tsx's placed-confirmation) rather than a path segment - unlike
// /qr/status, checkout is inherently scoped to one specific order's bill,
// not the whole session. `myGuestId` is read the same way /qr/cart already
// does: off the guest_display cookie (stamped at session start/join), no
// invented /me lookup.
export default async function CheckoutPage({ searchParams }: Readonly<{ searchParams: Promise<{ orderId?: string }> }>) {
  const [{ orderId }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const display = parseGuestSessionDisplay(cookieStore.get(GUEST_DISPLAY_COOKIE)?.value);
  return <CheckoutScreen orderId={orderId ?? null} myGuestId={display?.guestId ?? ""} />;
}
