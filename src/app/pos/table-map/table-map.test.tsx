import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableMap } from "./table-map";
import type { TableMapView } from "./table-map-state";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const CURRENT_STAFF = { id: "staff-me", name: "Ravi" };

function view(overrides: Partial<TableMapView> = {}): TableMapView {
  return {
    outletId: "o1",
    currentStaff: CURRENT_STAFF,
    floors: [{ id: "f1", name: "Ground Floor", sortOrder: 0 }],
    tables: [
      { id: "t1", floorId: "f1", label: "T1", seatCapacity: 2, status: "empty", order: null },
      {
        id: "t9",
        floorId: "f1",
        label: "T9",
        seatCapacity: 4,
        status: "occupied",
        order: { id: "order-t9", ownerStaffId: "staff-priya", ownerStaffName: "Priya", openedAt: new Date().toISOString() },
      },
      {
        id: "t4",
        floorId: "f1",
        label: "T4",
        seatCapacity: 4,
        status: "occupied",
        order: { id: "order-t4", ownerStaffId: "staff-me", ownerStaffName: "Ravi", openedAt: new Date().toISOString() },
      },
    ],
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

describe("TableMap", () => {
  it("shows a loading skeleton before the table map lands", async () => {
    stubFetch(() => jsonResponse(view()));
    render(<TableMap />);
    expect(screen.getByTestId("table-map-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());
  });

  it("shows a retryable error panel when the load fails", async () => {
    stubFetch(() => jsonResponse({ error: { message: "down" } }, 500));
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map-error")).toBeTruthy());
  });

  it("renders every table with a status color AND a visible text label - color is never the only signal", async () => {
    stubFetch(() => jsonResponse(view()));
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    const empty = screen.getByTestId("table-tile-t1");
    expect(within(empty).getByTestId("table-tile-status-t1").textContent).toBe("Available");
    expect(empty.dataset.status).toBe("empty");

    const occupied = screen.getByTestId("table-tile-t9");
    expect(within(occupied).getByTestId("table-tile-status-t9").textContent).toBe("Occupied");
    expect(occupied.dataset.status).toBe("occupied");
  });

  it("links to Open & Held Orders (CAP-5) - reachable from anywhere per EXPERIENCE.md's IA", async () => {
    stubFetch(() => jsonResponse(view()));
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    expect(screen.getByTestId("table-map-open-orders-link")).toHaveProperty(
      "href",
      expect.stringContaining("/pos/open-orders"),
    );
  });

  it("starts a new order when an empty table is tapped", async () => {
    const user = userEvent.setup();
    const startedOrder = {
      id: "t1",
      floorId: "f1",
      label: "T1",
      seatCapacity: 2,
      status: "occupied",
      order: { id: "order-new", ownerStaffId: "staff-me", ownerStaffName: "Ravi", openedAt: new Date().toISOString() },
    };
    stubFetch((url) => {
      if (url.endsWith("/pos/api/table-map")) return jsonResponse(view());
      if (url.endsWith("/pos/api/tables/t1/start-order")) return jsonResponse(startedOrder);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t1"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/pos/orders/order-new"));
  });

  it("opens directly when the current staff member already owns the table", async () => {
    const user = userEvent.setup();
    stubFetch(() => jsonResponse(view()));
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t4"));

    expect(push).toHaveBeenCalledWith("/pos/orders/order-t4");
    expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull();
  });

  it("shows the owner and the transfer action instead of opening someone else's table directly", async () => {
    const user = userEvent.setup();
    stubFetch(() => jsonResponse(view()));
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t9"));

    expect(push).not.toHaveBeenCalled();
    const dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("Priya");
  });

  it("completing a transfer updates the tile's owner and opens the order", async () => {
    const user = userEvent.setup();
    const transferred = {
      id: "t9",
      floorId: "f1",
      label: "T9",
      seatCapacity: 4,
      status: "occupied",
      order: { id: "order-t9", ownerStaffId: "staff-me", ownerStaffName: "Ravi", openedAt: new Date().toISOString() },
    };
    stubFetch((url) => {
      if (url.endsWith("/pos/api/table-map")) return jsonResponse(view());
      if (url.endsWith("/pos/api/orders/order-t9/transfer")) return jsonResponse(transferred);
      throw new Error(`unexpected fetch ${url}`);
    });
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t9"));
    await screen.findByTestId("transfer-ownership-dialog");
    await user.click(screen.getByTestId("transfer-confirm"));

    await waitFor(() => expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull());
    expect(push).toHaveBeenCalledWith("/pos/orders/order-t9");
  });

  it("cancelling the transfer dialog leaves the table untouched", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() => jsonResponse(view()));
    render(<TableMap />);
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t9"));
    await screen.findByTestId("transfer-ownership-dialog");
    await user.click(screen.getByTestId("transfer-cancel"));

    expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    // only the initial table-map GET happened - no transfer request was fired.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
