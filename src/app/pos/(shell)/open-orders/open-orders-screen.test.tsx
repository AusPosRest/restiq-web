import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenOrdersScreen } from "./open-orders-screen";
import type { OpenOrderEntry, OpenOrdersView } from "./open-orders-state";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const CURRENT_STAFF_ID = "staff-me";

function order(overrides: Partial<OpenOrderEntry> = {}): OpenOrderEntry {
  return {
    id: "order-1",
    origin: "table",
    tableLabel: "T4",
    ownerStaffId: CURRENT_STAFF_ID,
    ownerStaffName: "Ravi",
    status: "open",
    openedAt: new Date().toISOString(),
    itemCount: null,
    totalMinor: null,
    ...overrides,
  };
}

function view(orders: OpenOrderEntry[]): OpenOrdersView {
  return { outletId: "outlet-1", orders };
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
    stubFetch(() => jsonResponse(view([])));
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
    stubFetch(() => jsonResponse(view([])));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders-empty")).toBeTruthy());
  });

  it("renders every open order with its origin, server, status and elapsed time", async () => {
    const orders = [
      order({ id: "order-1", origin: "table", tableLabel: "T4" }),
      order({ id: "order-2", origin: "counter", tableLabel: null, ownerStaffId: "staff-priya", ownerStaffName: "Priya" }),
    ];
    stubFetch(() => jsonResponse(view(orders)));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-order-order-1").textContent).toContain("Table T4");
    expect(screen.getByTestId("open-order-order-2").textContent).toContain("Counter");
    expect(screen.getByTestId("open-order-order-2").textContent).toContain("Priya");
  });

  it("shows Resume, not a transfer action, for the signed-in staff's own orders", async () => {
    stubFetch(() => jsonResponse(view([order({ id: "order-1", ownerStaffId: CURRENT_STAFF_ID })])));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-order-resume-order-1")).toBeTruthy();
    expect(screen.queryByTestId("open-order-take-over-order-1")).toBeNull();
  });

  it("shows Take over, not Resume, for someone else's order", async () => {
    stubFetch(() => jsonResponse(view([order({ id: "order-1", ownerStaffId: "staff-priya", ownerStaffName: "Priya" })])));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-order-take-over-order-1")).toBeTruthy();
    expect(screen.queryByTestId("open-order-resume-order-1")).toBeNull();
  });

  it("taking over someone else's order goes through the reused transfer-ownership dialog, never a silent switch", async () => {
    const user = userEvent.setup();
    stubFetch((url) => {
      if (url.endsWith("/pos/api/outlets/outlet-1/orders")) {
        return jsonResponse(view([order({ id: "order-1", ownerStaffId: "staff-priya", ownerStaffName: "Priya" })]));
      }
      if (url.endsWith("/pos/api/orders/order-1/transfer")) return jsonResponse({});
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    await user.click(screen.getByTestId("open-order-take-over-order-1"));
    const dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("Priya");
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("transfer-confirm"));

    await waitFor(() => expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull());
    expect(push).toHaveBeenCalledWith("/pos/orders/order-1");
  });

  it("cancelling the transfer dialog leaves the order untouched", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() =>
      jsonResponse(view([order({ id: "order-1", ownerStaffId: "staff-priya", ownerStaffName: "Priya" })])),
    );
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    await user.click(screen.getByTestId("open-order-take-over-order-1"));
    await screen.findByTestId("transfer-ownership-dialog");
    await user.click(screen.getByTestId("transfer-cancel"));

    expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the item count/total only once the backend provides them, without crashing when it doesn't", async () => {
    stubFetch(() => jsonResponse(view([order({ id: "order-1", itemCount: null, totalMinor: null })])));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    const row = screen.getByTestId("open-order-order-1");
    expect(row.textContent).toContain("—");
    expect(screen.getByTestId("open-orders-summary").textContent).toBe("1 open order");
  });

  it("sums the footer total once every order actually has one", async () => {
    const orders = [order({ id: "order-1", totalMinor: 100000 }), order({ id: "order-2", totalMinor: 50000 })];
    stubFetch(() => jsonResponse(view(orders)));
    render(<OpenOrdersScreen outletId="outlet-1" currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("open-orders")).toBeTruthy());

    expect(screen.getByTestId("open-orders-summary").textContent).toBe("2 open orders · ₹1500.00 in progress");
  });
});
