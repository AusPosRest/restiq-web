import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { DeviceStatusScreen } from "./device-status-screen";

// Reads the outlet id server-side from the pos_staff cookie, same pattern as
// (shell)/shift/page.tsx - the real backend's attendance endpoint scopes to
// the session's own outlet, no picker needed.
export default async function PosStatusPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <DeviceStatusScreen outletId={display?.outlet.id ?? ""} />;
}
