import { StatusScreen } from "./status-screen";

// Q7 Order Status (CAP-6) - flat, session-gated route (decideGuestRoute's
// default branch, same convention as /qr/menu and /qr/cart). No per-guest
// display data is needed here (unlike /qr/cart's editable-own-lines split) -
// every order in the session is read-only on this screen.
export default function GuestStatusPage() {
  return <StatusScreen />;
}
