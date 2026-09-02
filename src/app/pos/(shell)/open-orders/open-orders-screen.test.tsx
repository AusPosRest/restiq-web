import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenOrdersScreen } from "./open-orders-screen";
import type { RawOpenOrder } from "./open-orders-state";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const CURRENT_STAFF_ID = "staff-me";

/** A fixture shaped exactly like the real backend's `GET /pos/v1/outlets/:outletId/orders` array entries. */
function order(overrides: Partial<RawOpenOrder> = {}): RawOpenOrder {
  return {
    id: "order-1",
    tableId: "table-4",
    ownerId: CURRENT_STAFF_ID,
    status: "open",
    createdAt: new Date().toISOString(),
    lines: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("OpenOrdersScreen", () => {
  it("shows a loading skeleton before the list lands", async () => {
    stubFetch(() => jsonResponse([]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    expect(screen.getByTestId("open-orders-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());
  });

  it("shows a retryable error panel when the load fails", async () => {
    stubFetch(() => jsonResponse({ error: { message: "down" } }, 500));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders-error")).toBeTruthy());
  });

  it("shows the empty state when there are no open orders", async () => {
    stubFetch(() => jsonResponse([]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders-empty")).toBeTruthy());
  });

  it("does not crash on the real bare-array payload, no { orders } wrapper (regression for #60)", async () => {
    stubFetch(() => jsonResponse([order({ id: "order-1" })]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());
    expect(screen.getByTestId("open-order-order-1")).toBeTruthy();
  });

  it("renders every open order with its origin, server, status and elapsed time", async () => {
    const orders = [
      order({ id: "order-1", tableId: "table-4" }),
      order({ id: "order-2", tableId: null, ownerId: "staff-priya" }),
    ];
    stubFetch(() => jsonResponse(orders));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-order-order-1").textContent).toContain("Table table-4");
    expect(screen.getByTestId("open-order-order-2").textContent).toContain("Counter");
    expect(screen.getByTestId("open-order-order-2").textContent).toContain("staff-priya");
  });

  it('shows "You" for the signed-in staff\'s own order, not their raw id', async () => {
    stubFetch(() => jsonResponse([order({ id: "order-1", ownerId: CURRENT_STAFF_ID })]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    const row = screen.getByTestId("open-order-order-1");
    expect(row.textContent).toContain("You");
    expect(row.textContent).not.toContain(CURRENT_STAFF_ID);
  });

  it("shows Resume, not a transfer action, for the signed-in staff's own orders", async () => {
    stubFetch(() => jsonResponse([order({ id: "order-1", ownerId: CURRENT_STAFF_ID })]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-order-resume-order-1")).toBeTruthy();
    expect(screen.queryByTestId("open-order-take-over-order-1")).toBeNull();
  });

  it("shows Take over, not Resume, for someone else's order", async () => {
    stubFetch(() => jsonResponse([order({ id: "order-1", ownerId: "staff-priya" })]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-order-take-over-order-1")).toBeTruthy();
    expect(screen.queryByTestId("open-order-resume-order-1")).toBeNull();
  });

  it("labels the transfer dialog by real origin - no double/wrong prefix for a table or counter order", async () => {
    const user = userEvent.setup();
    stubFetch(() =>
      jsonResponse([
        order({ id: "order-table", tableId: "table-4", ownerId: "staff-priya" }),
        order({ id: "order-counter", tableId: null, ownerId: "staff-priya" }),
      ]),
    );
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    await user.click(screen.getByTestId("open-order-take-over-order-table"));
    let dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("Table table-4");
    expect(dialog.textContent).not.toContain("Table Table");
    await user.click(screen.getByTestId("transfer-cancel"));

    await user.click(screen.getByTestId("open-order-take-over-order-counter"));
    dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("Counter");
    expect(dialog.textContent).not.toContain("Table Counter");
  });

  it("taking over someone else's order goes through the reused transfer-ownership dialog, never a silent switch", async () => {
    const user = userEvent.setup();
    stubFetch((url) => {
      if (url.endsWith("/pos/api/outlets/outlet-1/orders")) {
        return jsonResponse([order({ id: "order-1", ownerId: "staff-priya" })]);
      }
      if (url.endsWith("/pos/api/orders/order-1/transfer")) return jsonResponse({});
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    await user.click(screen.getByTestId("open-order-take-over-order-1"));
    const dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("staff-priya");
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("transfer-confirm"));

    await waitFor(() => expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull());
    expect(push).toHaveBeenCalledWith("/pos/orders/order-1");
  });

  it("cancelling the transfer dialog leaves the order untouched", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() => jsonResponse([order({ id: "order-1", ownerId: "staff-priya" })]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    await user.click(screen.getByTestId("open-order-take-over-order-1"));
    await screen.findByTestId("transfer-ownership-dialog");
    await user.click(screen.getByTestId("transfer-cancel"));

    expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a true zero item count/total for an order with no lines yet, without crashing", async () => {
    stubFetch(() => jsonResponse([order({ id: "order-1", lines: [] })]));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    const row = screen.getByTestId("open-order-order-1");
    expect(row.textContent).toContain("0");
    expect(screen.getByTestId("open-orders-summary").textContent).toBe("1 open order · ₹0.00 in progress");
  });

  it("sums the footer total from every order's lines", async () => {
    const orders = [
      order({ id: "order-1", lines: [{ quantity: 1, unitPriceMinor: 100000, modifiers: [] }] }),
      order({ id: "order-2", lines: [{ quantity: 1, unitPriceMinor: 50000, modifiers: [] }] }),
    ];
    stubFetch(() => jsonResponse(orders));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-orders-summary").textContent).toBe("2 open orders · ₹1500.00 in progress");
  });
});
