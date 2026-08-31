"use client";

// Q7 Order Status (CAP-6, issue #82): every order the table's session has
// placed, newest first, each with a StatusStepper (DESIGN.md: "Placed,
// Accepted, Preparing, Ready - amber active, green done") derived from the
// real ticket lifecycle via GET /guest/v1/session/orders (restiq-backend PR
// #83, src/guest/orders/orders.{dtos,service}.ts, read directly). The
// stepper never claims a state the data doesn't support - see
// status-state.ts's stepState, which mirrors buildOrderStatusView's own
// invariant exactly.
import { Check } from "lucide-react";
import Link from "next/link";
import { SessionEndedView } from "../session-ended-view";
import type { GuestOrderStatusView, GuestOrderStep } from "./status-api";
import { formatReachedAt, reachedAtFor, sortOrdersNewestFirst, STEP_LABELS, STEP_ORDER, stepState, type StepState } from "./status-state";
import { useStatusPoll } from "./use-status-poll";

// Q3 Menu Browse's conventional flat route (see cart-screen.tsx's MENU_ROUTE
// for the same literal) - the empty state's way back to ordering.
const MENU_ROUTE = "/qr/menu";

// Q6 Checkout (CAP-5, issue #84) - one of this story's two entry points
// (the other is cart-screen.tsx's placed-confirmation). orderId travels as a
// query param, not a path segment - checkout is scoped to one specific
// order's bill, unlike this screen's own session-wide order list.
const CHECKOUT_ROUTE = "/qr/checkout";

export function StatusScreen() {
  const poll = useStatusPoll();

  if (poll.sessionClosed) return <SessionEndedView />;
  if (poll.loading) return <LoadingSkeleton />;
  if (poll.failed || !poll.data) return <ErrorPanel onRetry={poll.retry} />;

  const orders = sortOrdersNewestFirst(poll.data.orders);

  return (
    <main data-testid="qr-status" className="flex min-h-screen flex-1 flex-col px-6 pb-12 pt-8">
      <h1 className="font-headline text-2xl font-semibold text-foreground">Your orders</h1>

      {poll.stale ? (
        <p data-testid="qr-status-stale-note" className="mt-2 text-xs text-muted-foreground">
          Showing the last update - reconnecting…
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4" role="region" aria-live="polite" aria-label="Your orders' status">
        {orders.length === 0 ? <EmptyState /> : orders.map((order) => <OrderCard key={order.orderId} order={order} />)}
      </div>
    </main>
  );
}

function OrderCard({ order }: Readonly<{ order: GuestOrderStatusView }>) {
  return (
    <section data-testid={`status-order-${order.orderId}`} className="rounded-xl border border-border bg-card p-4">
      <p data-testid={`status-order-id-${order.orderId}`} className="text-sm font-semibold text-foreground">
        Order #{order.orderId.slice(-6).toUpperCase()}
      </p>
      <Stepper order={order} />
      <Link
        href={`${CHECKOUT_ROUTE}?orderId=${order.orderId}`}
        data-testid={`status-request-bill-${order.orderId}`}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Request bill
      </Link>
    </section>
  );
}

function Stepper({ order }: Readonly<{ order: GuestOrderStatusView }>) {
  return (
    <ol data-testid={`status-stepper-${order.orderId}`} aria-label="Order progress" className="mt-4 flex items-start">
      {STEP_ORDER.map((step, index) => (
        <li key={step} className="flex flex-1 items-start last:flex-none">
          {index > 0 ? (
            <div
              aria-hidden="true"
              className={`mt-3.5 h-0.5 flex-1 ${stepState(step, order.step) !== "upcoming" ? "bg-step-done" : "bg-border"}`}
            />
          ) : null}
          <StepMarker order={order} step={step} />
        </li>
      ))}
    </ol>
  );
}

function StepMarker({ order, step }: Readonly<{ order: GuestOrderStatusView; step: GuestOrderStep }>) {
  const state = stepState(step, order.step);
  const reachedAt = reachedAtFor(order, step);
  const formattedTime = formatReachedAt(reachedAt);

  return (
    <div
      data-testid={`status-step-${order.orderId}-${step}`}
      aria-current={state === "active" ? "step" : undefined}
      className="flex w-16 flex-col items-center gap-1 text-center"
    >
      <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${markerClasses(state)}`}>
        {state === "done" ? <Check className="size-4" /> : stepNumber(step) + 1}
      </span>
      <span className={`text-[11px] font-medium leading-tight ${state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>
        {STEP_LABELS[step]}
      </span>
      {formattedTime ? (
        <span data-testid={`status-step-time-${order.orderId}-${step}`} className="text-[10px] tabular-nums text-muted-foreground">
          {formattedTime}
        </span>
      ) : null}
      <span className="sr-only">{state === "active" ? " - in progress" : state === "done" ? " - done" : " - not yet reached"}</span>
    </div>
  );
}

function stepNumber(step: GuestOrderStep): number {
  return STEP_ORDER.indexOf(step);
}

function markerClasses(state: StepState): string {
  if (state === "done") return "bg-step-done text-white";
  if (state === "active") return "bg-step-active text-primary-foreground";
  return "border border-border bg-transparent text-muted-foreground";
}

function EmptyState() {
  return (
    <div data-testid="qr-status-empty" className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 py-16 text-center">
      <p className="font-headline text-lg font-medium text-foreground">No orders yet</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">Browse the menu and place your table&apos;s first order.</p>
      <Link
        href={MENU_ROUTE}
        data-testid="qr-status-browse-menu"
        className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Browse the menu
      </Link>
    </div>
  );
}

function ErrorPanel({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main data-testid="qr-status-error" role="alert" className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load your orders.</p>
      <button
        type="button"
        data-testid="qr-status-retry"
        onClick={onRetry}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Retry
      </button>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div data-testid="qr-status-loading" className="flex min-h-screen flex-1 flex-col gap-4 px-6 pt-8">
      <p className="sr-only" role="status">
        Loading your orders…
      </p>
      <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded-md bg-accent" />
      <div aria-hidden="true" className="h-28 w-full animate-pulse rounded-xl bg-accent" />
      <div aria-hidden="true" className="h-28 w-full animate-pulse rounded-xl bg-accent" />
    </div>
  );
}

// Re-exported purely so tests can assert the surface's poll cadence without reaching into use-status-poll.ts directly.
export { STATUS_POLL_MS } from "./use-status-poll";
