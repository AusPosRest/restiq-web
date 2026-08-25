import { BillSettleView } from "./bill-settle-view";

export default async function PosBillSettlePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <BillSettleView orderId={orderId} />;
}
