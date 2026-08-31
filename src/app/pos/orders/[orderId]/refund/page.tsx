import { RefundView } from "./refund-view";

export default async function PosRefundPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <RefundView orderId={orderId} />;
}
