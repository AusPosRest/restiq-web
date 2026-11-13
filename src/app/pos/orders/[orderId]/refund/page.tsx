import { RefundView } from "./refund-view";

// `billId` rides in the query string because the real refund endpoint
// targets the Bill, not the Order (bills.controller.ts's `POST
// bills/:id/refund`, read directly), and there is no lookup-by-orderId route
// - the POS Payments list's "Refund" link (issue #405) has each finalized
// bill's real id in hand, so it passes it along here.
export default async function PosRefundPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ billId?: string }>;
}) {
  const { orderId } = await params;
  const { billId } = await searchParams;
  return <RefundView orderId={orderId} billId={billId ?? null} />;
}
