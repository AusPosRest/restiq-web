import { MenuView } from "./menu-view";

// Q3 Menu Browse (CAP-2) - gated behind a live guest session by proxy.ts's
// decideGuestRoute; a missing/expired token never reaches this component.
export default function GuestMenuPage() {
  return <MenuView />;
}
