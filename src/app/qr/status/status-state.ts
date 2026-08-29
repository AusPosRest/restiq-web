// Pure helpers for Q7 Order Status (CAP-6): step ordering/highlighting and
// time formatting, kept framework-free for unit testing (same split as
// cart/cart-state.ts).
import type { GuestOrderStatusView, GuestOrderStep } from "./status-api";

export const STEP_ORDER: readonly GuestOrderStep[] = ["placed", "accepted", "preparing", "ready"];

export const STEP_LABELS: Record<GuestOrderStep, string> = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
};

export type StepState = "done" | "active" | "upcoming";

/**
 * Whether `step` is done/active/upcoming relative to the order's furthest
 * reached step - a plain index comparison against `GuestOrderStatusView.step`
 * (the backend's own "furthest reached" field), not a re-derivation from
 * `reachedAt`. This matches `buildOrderStatusView`'s invariant exactly:
 * every step at or before the furthest one has a non-null `reachedAt`, every
 * step after it is null (see orders.service.ts) - so the two agree by
 * construction, and the highlight never needs to guess.
 */
export function stepState(step: GuestOrderStep, furthestStep: GuestOrderStep): StepState {
  const stepIndex = STEP_ORDER.indexOf(step);
  const furthestIndex = STEP_ORDER.indexOf(furthestStep);
  if (stepIndex < furthestIndex) return "done";
  if (stepIndex === furthestIndex) return "active";
  return "upcoming";
}

/** The `reachedAt` for one step of one order, or null while not yet reached - never fabricated. */
export function reachedAtFor(order: GuestOrderStatusView, step: GuestOrderStep): string | null {
  return order.steps.find((s) => s.step === step)?.reachedAt ?? null;
}

/** `reachedAt`'s ISO timestamp as a short local time (e.g. "10:32 AM"), or null to render nothing. */
export function formatReachedAt(reachedAt: string | null): string | null {
  if (!reachedAt) return null;
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(reachedAt));
}

/**
 * Newest-first for the session order list (task requirement) - the backend
 * returns them createdAt-ascending (orders.service.ts's listSessionOrders),
 * so this is a reverse keyed off each order's own `placed` step reachedAt
 * (always non-null - see buildOrderStatusView) rather than trusting array
 * order, in case that ever changes server-side.
 */
export function sortOrdersNewestFirst(orders: GuestOrderStatusView[]): GuestOrderStatusView[] {
  return [...orders].sort((a, b) => {
    const aPlaced = reachedAtFor(a, "placed") ?? "";
    const bPlaced = reachedAtFor(b, "placed") ?? "";
    return bPlaced.localeCompare(aPlaced);
  });
}
