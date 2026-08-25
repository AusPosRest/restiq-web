import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { OpenOrdersScreen } from "./open-orders-screen";

// Reads outletId/currentStaffId server-side from the pos_staff cookie (same
// pattern as (shell)/shift/page.tsx): the list is scoped to the session's
// own outlet, and "is this order mine" needs the signed-in staff id - neither
// should be a client-entered value.
export default async function PosOpenOrdersPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <OpenOrdersScreen outletId={display?.outlet.id ?? ""} currentStaffId={display?.staff.id ?? ""} />;
}
