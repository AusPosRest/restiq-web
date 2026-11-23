import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parsePosStaffDisplay, POS_STAFF_COOKIE, posLandingPath } from "@/lib/pos-session";

// Landing destination after PIN login (and the default `next`). The outlet
// type in the pos_staff cookie picks the screen: counter-service outlets get
// /pos/counter, everything else (and older backends with no type) the table map.
export default async function PosHomePage() {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  redirect(posLandingPath(display?.outlet.type));
}
