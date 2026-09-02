import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { CounterView } from "./counter-view";

// Reads outletId server-side from the pos_staff cookie (same pattern as
// table-map/page.tsx) - the real counter-order endpoint is outlet-scoped
// (`POST outlets/:outletId/counter-orders`, restiq-web#98's reconciliation
// of `startCounterOrder`), not a client-entered value.
export default async function PosCounterPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <CounterView outletId={display?.outlet.id ?? ""} />;
}
