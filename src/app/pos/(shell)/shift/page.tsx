import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { ShiftScreen } from "./shift-screen";

// Reads the outlet id server-side from the pos_staff cookie (same pattern as
// (shell)/layout.tsx) rather than asking staff to pick an outlet themselves -
// the real backend's openShift/getCurrentShift both scope to the session's
// own outlet.
export default async function PosShiftPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <ShiftScreen outletId={display?.outlet.id ?? ""} />;
}
