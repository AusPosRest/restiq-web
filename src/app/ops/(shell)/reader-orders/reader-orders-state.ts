// Reader orders (restiq-web#429): which moves ops can make from each status, and the page's
// status filter. Forward only; cancelling from paid/ordered refunds the platform payment.
import type { ReaderOrderStatus } from "@/lib/card-readers";

export type OrderAction = "ordered" | "shipped" | "delivered" | "cancelled";

const NEXT: Record<ReaderOrderStatus, OrderAction[]> = {
  paid: ["ordered", "cancelled"],
  ordered: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  payment_failed: [],
};

export function actionsFor(status: ReaderOrderStatus): OrderAction[] {
  return NEXT[status];
}

export const ACTION_LABEL: Record<OrderAction, string> = {
  ordered: "Mark ordered",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel & refund",
};

export const ACTION_DESCRIPTION: Record<OrderAction, string> = {
  ordered: "You've placed this order with Stripe. The owner sees it as Ordered.",
  shipped: "The reader is on its way. Add the tracking number if you have one — the owner sees it.",
  delivered: "The reader has arrived. This closes the order.",
  cancelled: "The order is cancelled and the owner's card is refunded in full. This can't be undone.",
};

/** PATCH body for a move; tracking only travels with "shipped", and only when typed. */
export function orderPatch(action: OrderAction, reason: string, trackingRef: string): { status: OrderAction; reason: string; trackingRef?: string } {
  const tracking = trackingRef.trim();
  return action === "shipped" && tracking ? { status: action, reason, trackingRef: tracking } : { status: action, reason };
}

/** "" = all statuses. The page opens on paid: the orders waiting on ops. */
export type OrderFilter = ReaderOrderStatus | "";

export const ORDER_FILTERS: Array<{ value: OrderFilter; label: string }> = [
  { value: "paid", label: "Needs action" },
  { value: "ordered", label: "Ordered" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "", label: "All" },
];

export function parseOrderFilter(value: string | null): OrderFilter {
  if (value === "all") return "";
  return ORDER_FILTERS.some((f) => f.value === value) ? (value as OrderFilter) : "paid";
}

export function ordersPath(filter: OrderFilter): string {
  return filter ? `reader-orders?status=${filter}` : "reader-orders";
}
