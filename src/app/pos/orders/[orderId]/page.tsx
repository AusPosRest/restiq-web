import { OrderStub } from "./order-stub";

export default async function PosOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderStub orderId={orderId} />;
}
