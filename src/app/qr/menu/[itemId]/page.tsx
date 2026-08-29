import { ItemDetailView } from "./item-detail-view";

// Q4 Item Detail (CAP-2) - gated behind a live guest session by proxy.ts's
// decideGuestRoute, same as the flat menu route.
export default async function GuestItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <ItemDetailView itemId={itemId} />;
}
