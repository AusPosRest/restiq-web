import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { ShiftBar } from "./shift-bar";

// Post-login POS shell (EXPERIENCE.md "Shift chrome"): a persistent top bar
// with the shift-status/clock indicator, present on every screen after PIN
// login. This story's scope is CAP-1 only - later stories add table map/QSR
// counter nav alongside it, same layering as /admin's (shell) group.
//
// Reads the pos_staff cookie server-side (set by the login/select-outlet
// route handlers - see src/lib/pos-session.ts) rather than fetching a
// session read-back endpoint: restiq-backend's real contract has no
// `/pos/v1/auth/me` (only login, select-outlet, and clock/out), so this is
// the reload-safe stand-in that costs no invented endpoint - exactly what
// the login response said, never fetched from thin air.
export default async function PosShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <ShiftBar initial={display} />
      <main className="flex flex-1 flex-col p-8">{children}</main>
    </div>
  );
}
