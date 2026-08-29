import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusScreen } from "./status-screen";
import type { GuestOrderStatusView, GuestSessionOrdersView } from "./status-api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const PREPARING_ORDER: GuestOrderStatusView = {
  orderId: "018f3ab2-9c4d-7e21-8a4b-11223344d4e5",
  tableId: "t1",
  step: "preparing",
  steps: [
    { step: "placed", reachedAt: "2026-08-29T10:00:00.000Z" },
    { step: "accepted", reachedAt: "2026-08-29T10:01:00.000Z" },
    { step: "preparing", reachedAt: "2026-08-29T10:01:00.000Z" },
    { step: "ready", reachedAt: null },
  ],
};

const READY_ORDER: GuestOrderStatusView = {
  orderId: "018f3ab2-0000-0000-0000-000000000001",
  tableId: "t1",
  step: "ready",
  steps: [
    { step: "placed", reachedAt: "2026-08-29T09:00:00.000Z" },
    { step: "accepted", reachedAt: "2026-08-29T09:01:00.000Z" },
    { step: "preparing", reachedAt: "2026-08-29T09:01:00.000Z" },
    { step: "ready", reachedAt: "2026-08-29T09:15:00.000Z" },
  ],
};

const TWO_ORDERS: GuestSessionOrdersView = { sessionId: "s1", orders: [READY_ORDER, PREPARING_ORDER] };
const EMPTY_ORDERS: GuestSessionOrdersView = { sessionId: "s1", orders: [] };

describe("StatusScreen", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("renders every order in the session, newest first", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_ORDERS)));
    render(<StatusScreen />);

    expect(await screen.findByTestId(`status-order-${PREPARING_ORDER.orderId}`)).toBeTruthy();
    const region = screen.getByLabelText("Your orders' status");
    const orderNodes = region.querySelectorAll("section[data-testid^='status-order-']");
    expect(orderNodes[0].getAttribute("data-testid")).toBe(`status-order-${PREPARING_ORDER.orderId}`);
    expect(orderNodes[1].getAttribute("data-testid")).toBe(`status-order-${READY_ORDER.orderId}`);
  });

  it("highlights the order's furthest reached step as active, marks earlier steps done, and leaves later steps upcoming", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { sessionId: "s1", orders: [PREPARING_ORDER] })));
    render(<StatusScreen />);
    await screen.findByTestId(`status-order-${PREPARING_ORDER.orderId}`);

    const placed = screen.getByTestId(`status-step-${PREPARING_ORDER.orderId}-placed`);
    const accepted = screen.getByTestId(`status-step-${PREPARING_ORDER.orderId}-accepted`);
    const preparing = screen.getByTestId(`status-step-${PREPARING_ORDER.orderId}-preparing`);
    const ready = screen.getByTestId(`status-step-${PREPARING_ORDER.orderId}-ready`);

    expect(placed.getAttribute("aria-current")).toBeNull();
    expect(accepted.getAttribute("aria-current")).toBeNull();
    expect(preparing.getAttribute("aria-current")).toBe("step");
    expect(ready.getAttribute("aria-current")).toBeNull();
  });

  it("shows reachedAt times for steps that have been reached, and none for steps that haven't", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { sessionId: "s1", orders: [PREPARING_ORDER] })));
    render(<StatusScreen />);
    await screen.findByTestId(`status-order-${PREPARING_ORDER.orderId}`);

    expect(screen.getByTestId(`status-step-time-${PREPARING_ORDER.orderId}-placed`)).toBeTruthy();
    expect(screen.getByTestId(`status-step-time-${PREPARING_ORDER.orderId}-accepted`)).toBeTruthy();
    expect(screen.queryByTestId(`status-step-time-${PREPARING_ORDER.orderId}-ready`)).toBeNull();
  });

  it("a freshly placed order (tickets fired synchronously) shows preparing active, not accepted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { sessionId: "s1", orders: [PREPARING_ORDER] })));
    render(<StatusScreen />);
    await screen.findByTestId(`status-order-${PREPARING_ORDER.orderId}`);

    expect(screen.getByTestId(`status-step-${PREPARING_ORDER.orderId}-accepted`).getAttribute("aria-current")).toBeNull();
    expect(screen.getByTestId(`status-step-${PREPARING_ORDER.orderId}-preparing`).getAttribute("aria-current")).toBe("step");
  });

  it("shows an inviting empty state linking back to the menu when there are no orders yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, EMPTY_ORDERS)));
    render(<StatusScreen />);

    expect(await screen.findByTestId("qr-status-empty")).toBeTruthy();
    const link = screen.getByTestId("qr-status-browse-menu") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/qr/menu");
  });

  it("shows a session-ended state on a 410, never a dead screen or auth error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(410, { error: { code: "session_closed", message: "closed" } })));
    render(<StatusScreen />);

    expect(await screen.findByTestId("qr-session-ended")).toBeTruthy();
  });

  it("has an aria-live region over the orders list so convergence is announced", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_ORDERS)));
    render(<StatusScreen />);
    await screen.findByTestId(`status-order-${PREPARING_ORDER.orderId}`);

    const region = screen.getByLabelText("Your orders' status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("shows an error state with retry when the first load fails", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(jsonResponse(200, EMPTY_ORDERS));
    vi.stubGlobal("fetch", fetchMock);
    render(<StatusScreen />);

    const retry = await screen.findByTestId("qr-status-retry");
    retry.click();

    await waitFor(() => expect(screen.getByTestId("qr-status-empty")).toBeTruthy());
  });
});
