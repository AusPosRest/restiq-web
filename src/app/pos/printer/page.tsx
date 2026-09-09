import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { PrinterScreen } from "./printer-screen";

// The simulated receipt printer (issue #172): reads the outlet from the
// pos_staff cookie server-side, same pattern as (shell)/status/page.tsx -
// the spool endpoint scopes to the session's own outlet.
export default async function PosPrinterPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <PrinterScreen outletId={display?.outlet.id ?? ""} outletName={display?.outlet.name ?? ""} />;
}
