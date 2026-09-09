import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { TerminalScreen } from "./terminal-screen";

// The simulated card terminal (issue #188): reads the outlet from the
// pos_staff cookie server-side, same pattern as ../printer/page.tsx - the
// pending-intents endpoint scopes to the session's own outlet.
export default async function PosTerminalPage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <TerminalScreen outletId={display?.outlet.id ?? ""} outletName={display?.outlet.name ?? ""} />;
}
