import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { PaymentsScreen } from "./payments-screen";

// Outlet id comes from the pos_staff cookie server-side, same as status/page.tsx.
export default async function PosPaymentsPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <PaymentsScreen outletId={display?.outlet.id ?? ""} />;
}
