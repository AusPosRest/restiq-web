// Q7 Order Status (CAP-6, issue #82): read-only session order tracking
// against the real, merged restiq-backend contract (PR #83,
// src/guest/orders/orders.{dtos,controller,service}.ts, read directly - not
// a guess). Shape copied field-for-field from the real `orders.dtos.ts`.
//
// The one endpoint this screen needs is `GET /guest/v1/session/orders` -
// every order the table's session has placed, each already carrying its own
// stepper state, so a single poll renders the whole list. The per-order
// `GET /guest/v1/orders/:orderId/status` exists on the backend too, but this
// screen has no reason to fetch one order at a time when the session list
// already returns all of them.
import { guestApi } from "../api-client";

export type GuestOrderStep = "placed" | "accepted" | "preparing" | "ready";

export interface GuestOrderStepView {
  step: GuestOrderStep;
  /** ISO timestamp the step was reached, or null while not yet reached - never fabricated. */
  reachedAt: string | null;
}

export interface GuestOrderStatusView {
  orderId: string;
  tableId: string | null;
  /** The furthest step this order has reached - what the stepper highlights. */
  step: GuestOrderStep;
  steps: GuestOrderStepView[];
}

export interface GuestSessionOrdersView {
  sessionId: string;
  orders: GuestOrderStatusView[];
}

/** GET /guest/v1/session/orders - every order the table's session has placed, newest-first is the caller's job (status-state.ts's sortOrdersNewestFirst). */
export function fetchSessionOrders(): Promise<GuestSessionOrdersView> {
  return guestApi<GuestSessionOrdersView>("session/orders");
}
