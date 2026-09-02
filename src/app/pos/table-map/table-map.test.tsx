import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableMap } from "./table-map";
import type { RawTableMapEntry } from "./table-map-state";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const OUTLET_ID = "outlet-1";
const CURRENT_STAFF_ID = "staff-me";
const CURRENT_STAFF_NAME = "Ravi";

/** A fixture shaped exactly like the real backend's `GET /pos/v1/outlets/:outletId/table-map` array entries. */
function tables(overrides: Partial<RawTableMapEntry>[] = []): RawTableMapEntry[] {
  const base: RawTableMapEntry[] = [
    { tableId: "t1", floorId: "f1", floorName: "Ground Floor", label: "T1", seatCapacity: 2, status: "empty", orderId: null, ownerId: null },
    { tableId: "t9", floorId: "f1", floorName: "Ground Floor", label: "T9", seatCapacity: 4, status: "occupied", orderId: "order-t9", ownerId: "staff-priya" },
    { tableId: "t4", floorId: "f1", floorName: "Ground Floor", label: "T4", seatCapacity: 4, status: "occupied", orderId: "order-t4", ownerId: CURRENT_STAFF_ID },
  ];
  return overrides.length ? base.map((t, i) => ({ ...t, ...overrides[i] })) : base;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderTableMap() {
  return render(<TableMap outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} currentStaffName={CURRENT_STAFF_NAME} />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("TableMap", () => {
  it("shows a loading skeleton before the table map lands", async () => {
    stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    expect(screen.getByTestId("table-map-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());
  });

  it("fetches the outlet-scoped real endpoint, not the old bare path (regression for #61's 404)", async () => {
    const fetchMock = stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/pos/api/outlets/${OUTLET_ID}/table-map`), expect.anything());
  });

  it("shows a retryable error panel when the load fails", async () => {
    stubFetch(() => jsonResponse({ error: { message: "down" } }, 500));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map-error")).toBeTruthy());
  });

  it("renders every table with a status color AND a visible text label - color is never the only signal", async () => {
    stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    const empty = screen.getByTestId("table-tile-t1");
    expect(within(empty).getByTestId("table-tile-status-t1").textContent).toBe("Available");
    expect(empty.dataset.status).toBe("empty");

    const occupied = screen.getByTestId("table-tile-t9");
    expect(within(occupied).getByTestId("table-tile-status-t9").textContent).toBe("Occupied");
    expect(occupied.dataset.status).toBe("occupied");
  });

  it("shows the signed-in staff member's name from the server-resolved session, not a fetched field", async () => {
    stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());
    expect(screen.getByTestId("current-staff").textContent).toContain(CURRENT_STAFF_NAME);
  });

  it("shows the real floor name in the group heading, never the raw floorId UUID (regression for #96)", async () => {
    stubFetch(() =>
      jsonResponse(tables([{ floorId: "01a06107-0000-4000-8000-000000000001", floorName: "Ground Floor" }])),
    );
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    const heading = screen.getByTestId("floor-group-01a06107-0000-4000-8000-000000000001");
    expect(heading.textContent).toContain("Ground Floor");
    expect(heading.textContent).not.toContain("01a06107");
  });

  it("links to Open & Held Orders (CAP-5) - reachable from anywhere per EXPERIENCE.md's IA", async () => {
    stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    expect(screen.getByTestId("table-map-open-orders-link")).toHaveProperty(
      "href",
      expect.stringContaining("/pos/open-orders"),
    );
  });

  it("starts a new order when an empty table is tapped, posting to the real outlet/table-scoped route", async () => {
    const user = userEvent.setup();
    const startedOrder = { id: "order-new", tenantId: "t", outletId: OUTLET_ID, tableId: "t1", ownerId: CURRENT_STAFF_ID, status: "open", tokenNumber: null, createdAt: "now", updatedAt: "now", lines: [] };
    const fetchMock = stubFetch((url) => {
      if (url.endsWith(`/pos/api/outlets/${OUTLET_ID}/table-map`)) return jsonResponse(tables());
      if (url.endsWith(`/pos/api/outlets/${OUTLET_ID}/tables/t1/order`)) return jsonResponse(startedOrder);
      throw new Error(`unexpected fetch ${url}`);
    });
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t1"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/pos/orders/order-new"));
    const startCall = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/tables/t1/order`));
    expect((startCall?.[1] as RequestInit | undefined)?.method).toBe("POST");
  });

  it("reflects the server's real owner after a get-or-claim race (openOrClaimTable can return a pre-existing order owned by someone else), requiring transfer on a second tap instead of a silent open", async () => {
    const user = userEvent.setup();
    const claimedOrder = { id: "order-t1", tenantId: "t", outletId: OUTLET_ID, tableId: "t1", ownerId: "staff-other", status: "open", tokenNumber: null, createdAt: "now", updatedAt: "now", lines: [] };
    const fetchMock = stubFetch((url) => {
      if (url.endsWith(`/pos/api/outlets/${OUTLET_ID}/table-map`)) return jsonResponse(tables());
      if (url.endsWith(`/pos/api/outlets/${OUTLET_ID}/tables/t1/order`)) return jsonResponse(claimedOrder);
      throw new Error(`unexpected fetch ${url}`);
    });
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pos/orders/order-t1"));
    push.mockClear();

    // A second tap on the same tile must resolve from the tile's own local
    // state, which should now carry the server's real ownerId (staff-other),
    // not the tapping staff - so this tap goes through the transfer flow
    // instead of silently reopening the order as if the tapper owned it.
    await user.click(screen.getByTestId("table-tile-t1"));

    expect(push).not.toHaveBeenCalled();
    const dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("staff-other");
    expect(fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(`/tables/t1/order`))).toHaveLength(1);
  });

  it("opens directly when the current staff member already owns the table", async () => {
    const user = userEvent.setup();
    stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t4"));

    expect(push).toHaveBeenCalledWith("/pos/orders/order-t4");
    expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull();
  });

  it("shows the raw owner id and the transfer action instead of opening someone else's table directly - no name-lookup endpoint exists server-side", async () => {
    const user = userEvent.setup();
    stubFetch(() => jsonResponse(tables()));
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t9"));

    expect(push).not.toHaveBeenCalled();
    const dialog = await screen.findByTestId("transfer-ownership-dialog");
    expect(dialog.textContent).toContain("staff-priya");
  });

  it("completing a transfer sends newOwnerStaffId (the real TransferOrderDto requires it) and opens the order", async () => {
    const user = userEvent.setup();
    const transferred = { id: "order-t9", tenantId: "t", outletId: OUTLET_ID, tableId: "t9", ownerId: CURRENT_STAFF_ID, status: "open", tokenNumber: null, createdAt: "now", updatedAt: "now", lines: [] };
    const fetchMock = stubFetch((url) => {
      if (url.endsWith(`/pos/api/outlets/${OUTLET_ID}/table-map`)) return jsonResponse(tables());
      if (url.endsWith("/pos/api/orders/order-t9/transfer")) return jsonResponse(transferred);
      throw new Error(`unexpected fetch ${url}`);
    });
    renderTableMap();
    await waitFor(() => expect(screen.getByTestId("table-map")).toBeTruthy());

    await user.click(screen.getByTestId("table-tile-t9"));
    await screen.findByTestId("transfer-ownership-dialog");
    await user.click(screen.getByTestId("transfer-confirm"));

    await waitFor(() => expect(screen.queryByTestId("transfer-ownership-dialog")).toBeNull());
    expect(push).toHaveBeenCalledWith("/pos/orders/order-t9");
    const transferCall = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/orders/order-t9/transfer"));
    expect(JSON.parse((transferCall?.[1] as RequestInit).body as string)).toEqual({ newOwnerStaffId: CURRENT_STAFF_ID });
  });

  it("cancelling the transfer dialog leaves the table untouched", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() => jsonResponse(tables()));
    renderTableMap();
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
