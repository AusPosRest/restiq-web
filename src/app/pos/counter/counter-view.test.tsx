// Component tests for the real P7 QSR Counter screen (CAP-6, story 7). No
// live restiq-backend to verify against yet (see counter-view.tsx's file
// header), so every network call is stubbed against this story's own
// self-authored contract, same convention as order-taking-view.test.tsx and
// bill-settle-view.test.tsx - this screen composes both of those already-
// tested contracts, so these tests focus on the composition (one continuous
// flow, the token number, reused components behaving as before) rather than
// re-testing modifier-sheet/tender-keypad/bill-summary internals already
// covered by story 4/8's own suites.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CounterView } from "./counter-view";
import type { BillView } from "../orders/[orderId]/settle/bill-state";
import type { OrderView, PosMenuView } from "../orders/[orderId]/order-taking-state";

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

function counterOrder(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: "order-47",
    tableId: null,
    tableLabel: "Takeaway",
    status: "occupied",
    ownerStaffId: "staff-priya",
    ownerStaffName: "Priya",
    openedAt: new Date().toISOString(),
    currency: "INR",
    lines: [],
    totalMinor: 0,
    tokenNumber: 47,
    ...overrides,
  };
}

function bill(orderId: string, overrides: Partial<BillView> = {}): BillView {
  return {
    id: `bill-${orderId}`,
    billNumber: "TN1-000047",
    orderId,
    tableLabel: "Takeaway",
    currency: "INR",
    status: "draft",
    lines: [],
    subtotalMinor: 0,
    discount: null,
    taxLines: [],
    roundOffMinor: 0,
    grandTotalMinor: 0,
    tenders: [],
    tenderedMinor: 0,
    remainingMinor: 0,
    finalisedAt: null,
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
});

describe("CounterView - starting a counter order", () => {
  it("starts a counter order on mount and shows the assigned token number", async () => {
    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      "POST orders/counter": () => jsonResponse(counterOrder()),
      "GET orders/order-47/bill": () => jsonResponse(bill("order-47")),
    });
    render(<CounterView />);

    await screen.findByTestId("counter-view");
    expect(screen.getByTestId("token-badge-number").textContent).toBe("#47");
    expect(screen.getByTestId("counter-cashier").textContent).toContain("Priya");
  });

  it("shows a retryable error panel if the counter order can't be started", async () => {
    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      "POST orders/counter": () => jsonResponse({ error: { message: "down" } }, 500),
    });
    render(<CounterView />);
    await waitFor(() => expect(screen.getByTestId("counter-order-error")).toBeTruthy());
  });
});

describe("CounterView - ring up and settle in one continuous flow", () => {
  it("rings up an item and settles the bill without navigating away from /pos/counter", async () => {
    const user = userEvent.setup();
    let currentBill = bill("order-47");

    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      "POST orders/counter": () => jsonResponse(counterOrder()),
      "GET orders/order-47/bill": () => jsonResponse(currentBill),
      "POST orders/order-47/lines": () => {
        const withNaan = counterOrder({
          lines: [
            {
              id: "line-1",
              itemId: "item-naan",
              itemName: "Butter Naan",
              variantId: null,
              variantName: null,
              quantity: 1,
              unitPriceMinor: 6000,
              modifiers: [],
              lineTotalMinor: 6000,
              specialInstructions: null,
              addedByStaffId: "staff-priya",
              addedByStaffName: "Priya",
              addedAt: new Date().toISOString(),
            },
          ],
          totalMinor: 6000,
        });
        currentBill = bill("order-47", {
          lines: withNaan.lines,
          subtotalMinor: 6000,
          grandTotalMinor: 6000,
          remainingMinor: 6000,
        });
        return jsonResponse(withNaan);
      },
      "POST orders/order-47/bill/tenders": () => {
        currentBill = { ...currentBill, tenders: [{ id: "t1", method: "cash", amountMinor: 6000, capturedAt: new Date().toISOString() }], tenderedMinor: 6000, remainingMinor: 0 };
        return jsonResponse(currentBill);
      },
      "POST orders/order-47/bill/finalize": () => {
        currentBill = { ...currentBill, status: "finalised", finalisedAt: new Date().toISOString() };
        return jsonResponse(currentBill);
      },
    });

    render(<CounterView />);
    await screen.findByTestId("counter-view");

    // Ring up: no-modifier item adds straight to the order, same behavior as
    // story 4's order-taking screen.
    await user.click(screen.getByTestId("item-tile-item-naan"));
    await waitFor(() => expect(screen.getByTestId("bill-line-line-1")).toBeTruthy());
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹60.00");

    // Settle right here, no navigation to a /settle route.
    await user.click(screen.getByTestId("tender-fill-remaining"));
    await waitFor(() => expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", false));

    await user.click(screen.getByTestId("finalize-bill"));

    await screen.findByTestId("counter-settled-panel");
    expect(screen.getByTestId("token-badge-number").textContent).toBe("#47");
    // No mutation UI survives finalisation, same AD-14 discipline as bill-settle-view.
    expect(screen.queryByTestId("tender-keypad")).toBeNull();
    expect(screen.queryByTestId("item-grid")).toBeNull();
  });

  it("starting the next order after settling issues a fresh token number", async () => {
    const user = userEvent.setup();
    let orderCount = 0;

    stubFetch({
      "GET menu": () => jsonResponse(MENU),
      "POST orders/counter": () => {
        orderCount += 1;
        return jsonResponse(counterOrder({ id: `order-${46 + orderCount}`, tokenNumber: 46 + orderCount }));
      },
      "GET orders/order-47/bill": () => jsonResponse(bill("order-47", { status: "finalised", finalisedAt: new Date().toISOString(), tenders: [{ id: "t1", method: "cash", amountMinor: 0, capturedAt: new Date().toISOString() }] })),
      "GET orders/order-48/bill": () => jsonResponse(bill("order-48")),
    });

    render(<CounterView />);
    await screen.findByTestId("counter-settled-panel");
    expect(screen.getByTestId("token-badge-number").textContent).toBe("#47");

    await user.click(screen.getByTestId("counter-start-next-order"));

    await waitFor(() => expect(screen.getByTestId("token-badge-number").textContent).toBe("#48"));
    expect(screen.getByTestId("item-grid")).toBeTruthy();
  });
});
