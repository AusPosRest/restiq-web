import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { OrderTakingView } from "./order-taking-view";

// Reads currentStaffId server-side from the pos_staff cookie (same pattern
// as table-map/page.tsx and (shell)/open-orders/page.tsx): "is this my own
// line/order" needs the signed-in staff id, which should never be a
// client-entered value.
export default async function PosOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);
  return <OrderTakingView orderId={orderId} currentStaffId={display?.staff.id ?? ""} />;
}
