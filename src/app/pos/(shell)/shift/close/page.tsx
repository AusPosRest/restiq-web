import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { CloseShiftScreen } from "./close-shift-screen";

export default async function PosCloseShiftPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <CloseShiftScreen outletId={display?.outlet.id ?? ""} />;
}
