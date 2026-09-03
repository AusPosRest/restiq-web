// Component tests for the real P7 QSR Counter screen (CAP-6, story 7),
// reconciled (restiq-web#98) against the real, merged restiq-backend
// `outlets/:outletId/counter-orders` and `src/pos/bills/*` contracts. These
// tests focus on the composition (one continuous flow, the token number,
// reused components behaving as before) rather than re-testing modifier-
// sheet/tender-keypad/bill-summary internals already covered by story 4/8's
// own suites.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CounterView } from "./counter-view";
import type { BillView } from "../orders/[orderId]/settle/bill-state";
import type { PosMenuView, RawOrder } from "../orders/[orderId]/order-taking-state";

const OUTLET_ID = "outlet-1";
const CURRENT_STAFF_ID = "staff-priya";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const MENU: PosMenuView = {
  currency: "INR",
  categories: [{ id: "cat-starters", name: "Starters", sortOrder: 0 }],
  items: [
    {
      id: "item-naan",
      categoryId: "cat-starters",
      name: "Butter Naan",
      shortName: "Butter Naan",
      available: true,
      priceMinor: 6000,
      variants: [],
      modifierGroups: [],
    },
  ],
};

function counterOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    id: "order-47",
    tenantId: "tenant-1",
    outletId: OUTLET_ID,
    tableId: null,
    tableLabel: null,
    ownerId: "staff-priya",
    status: "open",
    tokenNumber: 47,
    createdAt: "2026-08-25T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
    lines: [],
    ...overrides,
  };
}

function bill(orderId: string, overrides: Partial<BillView> = {}): BillView {
  return {
    id: `bill-${orderId}`,
    orderId,
    billNumber: null,
    status: "open",
    subtotalMinor: 0,
    taxMinor: 0,
    discountMinor: null,
    discountReason: null,
    totalMinor: 0,
    createdAt: "2026-08-25T09:00:00.000Z",
    finalizedAt: null,
    tenders: [],
    ...overrides,
  };
}

function stubFetch(handlers: Partial<Record<string, (init?: RequestInit) => Response>>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.replace(/^.*\/pos\/api\//, "")}`;
    if (handlers[key]) return Promise.resolve(handlers[key]!(init));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: `unhandled ${key}` } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("CounterView - starting a counter order", () => {
  it("starts an outlet-scoped counter order on mount and shows the assigned token number", async () => {
    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      [`POST outlets/${OUTLET_ID}/counter-orders`]: () => jsonResponse(counterOrder(), 201),
      "POST orders/order-47/bill": () => jsonResponse(bill("order-47"), 201),
    });
    render(<CounterView outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} />);

    await screen.findByTestId("counter-view");
    expect(screen.getByTestId("token-badge-number").textContent).toBe("#47");
    expect(screen.getByTestId("counter-cashier").textContent).toContain("You");
  });

  it("shows the raw owner id for a counter order started by someone else's terminal", async () => {
    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      [`POST outlets/${OUTLET_ID}/counter-orders`]: () => jsonResponse(counterOrder({ ownerId: "staff-arjun" }), 201),
      "POST orders/order-47/bill": () => jsonResponse(bill("order-47"), 201),
    });
    render(<CounterView outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} />);

    await screen.findByTestId("counter-view");
    expect(screen.getByTestId("counter-cashier").textContent).toContain("staff-arjun");
    expect(screen.getByTestId("counter-cashier").textContent).not.toContain("You");
  });

  it("shows a retryable error panel if the counter order can't be started", async () => {
    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      [`POST outlets/${OUTLET_ID}/counter-orders`]: () => jsonResponse({ error: { message: "down" } }, 500),
    });
    render(<CounterView outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} />);
    await waitFor(() => expect(screen.getByTestId("counter-order-error")).toBeTruthy());
  });
});

describe("CounterView - ring up and settle in one continuous flow", () => {
  it("rings up an item and settles the bill without navigating away from /pos/counter", async () => {
    const user = userEvent.setup();
    let currentBill = bill("order-47");

    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      [`POST outlets/${OUTLET_ID}/counter-orders`]: () => jsonResponse(counterOrder(), 201),
      "POST orders/order-47/bill": () => jsonResponse(currentBill, 201),
      "POST orders/order-47/lines": () => {
        currentBill = { ...currentBill, subtotalMinor: 6000, taxMinor: 300, totalMinor: 6300 };
        return jsonResponse(
          counterOrder({
            lines: [
              {
                id: "line-1",
                orderId: "order-47",
                itemId: "item-naan",
                variantId: null,
                quantity: 1,
                unitPriceMinor: 6000,
                seatNumber: null,
                addedByStaffId: "staff-priya",
                createdAt: "2026-08-25T09:01:00.000Z",
                modifiers: [],
              },
            ],
          }),
        );
      },
      "POST bills/bill-order-47/finalize": (init) => {
        const body = JSON.parse(String(init?.body)) as { tenders: { method: string; amountMinor: number }[] };
        currentBill = {
          ...currentBill,
          status: "finalized",
          finalizedAt: "2026-08-25T09:05:00.000Z",
          tenders: body.tenders.map((t, i) => ({ id: `t${i}`, method: t.method as "cash" | "upi_manual", amountMinor: t.amountMinor, createdAt: "2026-08-25T09:05:00.000Z" })),
        };
        return jsonResponse(currentBill);
      },
    });

    render(<CounterView outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} />);
    await screen.findByTestId("counter-view");

    // Ring up: no-modifier item adds straight to the order, same behavior as
    // story 4's order-taking screen.
    await user.click(screen.getByTestId("item-tile-item-naan"));
    await waitFor(() => expect(screen.getByTestId("bill-line-line-1")).toBeTruthy());
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹63.00");
    // Regression: addOrderLine must pass the loaded menu through, or the
    // line falls back to the raw itemId instead of a resolved name.
    expect(screen.getByTestId("bill-line-line-1").textContent).toContain("Butter Naan");
    expect(screen.getByTestId("bill-line-line-1").textContent).not.toContain("item-naan");

    // Settle right here, no navigation to a /settle route.
    await user.click(screen.getByTestId("tender-fill-remaining"));
    await waitFor(() => expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", false));

    await user.click(screen.getByTestId("finalize-bill"));

    await screen.findByTestId("counter-settled-panel");
    expect(screen.getByTestId("token-badge-number").textContent).toBe("#47");
    // No mutation UI survives finalization, same AD-14 discipline as bill-settle-view.
    expect(screen.queryByTestId("tender-keypad")).toBeNull();
    expect(screen.queryByTestId("item-grid")).toBeNull();
    expect(screen.getByTestId("print-invoice-link").getAttribute("href")).toBe("/pos/bills/bill-order-47/invoice");
  });

  it("bumps the existing line's quantity on a repeat tap instead of adding a duplicate line (#129)", async () => {
    const user = userEvent.setup();
    let posts = 0;
    let patches = 0;
    const line = {
      id: "line-1",
      orderId: "order-47",
      itemId: "item-naan",
      variantId: null,
      quantity: 1,
      unitPriceMinor: 6000,
      seatNumber: null,
      addedByStaffId: "staff-priya",
      createdAt: "2026-08-25T09:01:00.000Z",
      modifiers: [],
    };
    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      [`POST outlets/${OUTLET_ID}/counter-orders`]: () => jsonResponse(counterOrder(), 201),
      "POST orders/order-47/bill": () => jsonResponse(bill("order-47"), 201),
      "POST orders/order-47/lines": () => {
        posts += 1;
        return jsonResponse(counterOrder({ lines: [line] }));
      },
      "PATCH orders/order-47/lines/line-1": (init) => {
        patches += 1;
        const body = JSON.parse(String(init?.body)) as { quantity: number };
        return jsonResponse(counterOrder({ lines: [{ ...line, quantity: body.quantity }] }));
      },
    });

    render(<CounterView outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} />);
    await screen.findByTestId("counter-view");

    await user.click(screen.getByTestId("item-tile-item-naan"));
    await waitFor(() => expect(screen.getByTestId("bill-line-line-1")).toBeTruthy());
    await user.click(screen.getByTestId("item-tile-item-naan"));
    await waitFor(() => expect(patches).toBe(1));

    expect(posts).toBe(1);
    // Exactly one line row (row ids are bill-line-<lineId>; child cells carry longer ids).
    expect(screen.queryAllByTestId(/^bill-line-line-\d+$/)).toHaveLength(1);
    expect(screen.getByTestId("bill-line-line-1").textContent).toContain("2");
  });

  it("starting the next order after settling issues a fresh token number", async () => {
    const user = userEvent.setup();
    let orderCount = 0;

    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      [`POST outlets/${OUTLET_ID}/counter-orders`]: () => {
        orderCount += 1;
        return jsonResponse(counterOrder({ id: `order-${46 + orderCount}`, tokenNumber: 46 + orderCount }), 201);
      },
      "POST orders/order-47/bill": () =>
        jsonResponse(bill("order-47", { status: "finalized", finalizedAt: "2026-08-25T09:05:00.000Z", tenders: [{ id: "t1", method: "cash", amountMinor: 0, createdAt: "2026-08-25T09:05:00.000Z" }] }), 201),
      "POST orders/order-48/bill": () => jsonResponse(bill("order-48"), 201),
    });

    render(<CounterView outletId={OUTLET_ID} currentStaffId={CURRENT_STAFF_ID} />);
    await screen.findByTestId("counter-settled-panel");
    expect(screen.getByTestId("token-badge-number").textContent).toBe("#47");

    await user.click(screen.getByTestId("counter-start-next-order"));

    await waitFor(() => expect(screen.getByTestId("token-badge-number").textContent).toBe("#48"));
    expect(screen.getByTestId("item-grid")).toBeTruthy();
  });
});
