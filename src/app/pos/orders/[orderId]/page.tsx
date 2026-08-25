import { OrderTakingView } from "./order-taking-view";

export default async function PosOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderTakingView orderId={orderId} />;
}
