import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { TableMap } from "./table-map";

// Reads outletId/currentStaffId/currentStaffName server-side from the
// pos_staff cookie (same pattern as (shell)/open-orders/page.tsx): the real
// table-map endpoint is outlet-scoped and identifying which tile is "your
// own order" needs the signed-in staff id - neither should be a
// client-entered value.
export default async function PosTableMapPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return (
    <TableMap
      outletId={display?.outlet.id ?? ""}
      currentStaffId={display?.staff.id ?? ""}
      currentStaffName={display?.staff.name ?? ""}
    />
  );
}
