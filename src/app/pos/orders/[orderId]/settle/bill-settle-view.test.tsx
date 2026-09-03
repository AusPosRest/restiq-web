// Component tests for the real P8 bill & settle screen, reconciled
// (restiq-web#98) against the real, merged restiq-backend `src/pos/bills/*`
// contract - every stubbed route/shape below is the real one (bills.dtos.ts/
// bills.controller.ts, read directly), not a self-authored guess.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillSettleView } from "./bill-settle-view";
import type { BillView } from "./bill-state";
import type { PosMenuView, RawOrder } from "../order-taking-state";

const ORDER_ID = "order-1042";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const MENU: PosMenuView = {
  currency: "INR",
  categories: [{ id: "cat-mains", name: "Mains", sortOrder: 0 }],
  items: [
    {
      id: "item-risotto",
      categoryId: "cat-mains",
      name: "Truffle Mushroom Risotto",
      shortName: "Risotto",
      available: true,
      priceMinor: 39000,
      variants: [],
      modifierGroups: [],
    },
  ],
};

function rawOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    id: ORDER_ID,
    tenantId: "tenant-1",
    outletId: "outlet-1",
    tableId: "table-4",
    tableLabel: "T4",
    ownerId: "staff-1",
    status: "sent",
    tokenNumber: null,
    createdAt: "2026-08-25T09:00:00.000Z",
    updatedAt: "2026-08-25T09:30:00.000Z",
    lines: [
      {
        id: "line-1",
        orderId: ORDER_ID,
        itemId: "item-risotto",
        variantId: null,
        quantity: 2,
        unitPriceMinor: 39000,
        seatNumber: 1,
        addedByStaffId: "staff-1",
        createdAt: "2026-08-25T09:05:00.000Z",
        modifiers: [],
      },
    ],
    ...overrides,
  };
}

function makeBill(overrides: Partial<BillView> = {}): BillView {
  return {
    id: "bill-1",
    orderId: ORDER_ID,
    billNumber: null,
    status: "open",
    subtotalMinor: 78000,
    taxMinor: 3900, // bill-core.ts's flat 5% placeholder
    discountMinor: null,
    discountReason: null,
    totalMinor: 81900,
    createdAt: "2026-08-25T10:00:00.000Z",
    finalizedAt: null,
    tenders: [],
    ...overrides,
  };
}

function stubFetch(handlers: Partial<Record<string, (init?: RequestInit) => Response>> = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.replace(/^.*\/pos\/api\//, "")}`;

    if (handlers[key]) return Promise.resolve(handlers[key]!(init));
    if (key === `GET orders/${ORDER_ID}`) return Promise.resolve(jsonResponse(rawOrder()));
    if (key === "GET menu") return Promise.resolve(jsonResponse(MENU));
    if (key === `POST orders/${ORDER_ID}/bill`) return Promise.resolve(jsonResponse(makeBill(), 201));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: `unhandled ${key}` } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BillSettleView - loading", () => {
  it("creates the bill for this order (a real 201) and shows its subtotal/tax/total", async () => {
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("bill-line-line-1")).toBeTruthy();
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹819.00");
  });

  it("shows the real table label in the header, never the raw table id (regression for #96)", async () => {
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    const summary = await screen.findByTestId("bill-summary");
    expect(summary.textContent).toContain("Table T4");
    expect(summary.textContent).not.toContain("table-4");
  });

  it("renders the same bill on a 200 (an order that already has one) - restiq-backend#98 made the POST idempotent per order", async () => {
    stubFetch({
      [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse(makeBill({ id: "bill-existing" }), 200),
    });

    render(<BillSettleView orderId={ORDER_ID} />);

    const summary = await screen.findByTestId("bill-summary");
    expect(summary.textContent).toContain("₹819.00");
  });

  it("reopens correctly in a fresh tab with no storage at all, and never touches sessionStorage (a repeat POST for an already-billed order just returns 200)", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get(): never {
        throw new Error("sessionStorage should not be touched - the settle screen no longer caches a bill id");
      },
    });
    try {
      stubFetch({
        [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse(makeBill({ id: "bill-existing" }), 200),
      });
      render(<BillSettleView orderId={ORDER_ID} />);
      await screen.findByTestId("bill-summary");
    } finally {
      Object.defineProperty(window, "sessionStorage", originalDescriptor);
    }
  });

  it("shows the error state on a genuine 409 (an order closed with no bill ever created)", async () => {
    stubFetch({
      [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse({ error: { code: "conflict", message: "This order is already closed" } }, 409),
    });

    render(<BillSettleView orderId={ORDER_ID} />);

    expect(await screen.findByTestId("bill-settle-error")).toBeTruthy();
  });
});

describe("BillSettleView - tenders", () => {
  it("accumulates tenders locally (no network call per tap) and updates the remaining figure", async () => {
    const fetchMock = stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹819.00");

    for (const digit of ["5", "0", "0", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    await userEvent.click(screen.getByTestId("tender-add"));

    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹319.00");
    expect(screen.getByTestId("tender-captured-list").textContent).toContain("₹500.00");
    // Purely local - no finalize/tender endpoint hit yet.
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/finalize") || String(input).includes("/tenders"))).toBe(false);

    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹0.00");
  });

  it("removes a pending tender before finalizing", async () => {
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹0.00");

    await userEvent.click(screen.getByTestId("tender-remove-0"));
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹819.00");
  });
});

describe("BillSettleView - finalize", () => {
  it("disables Finalize until pending tenders exactly cover the total, then submits discount + tenders together", async () => {
    const fetchMock = stubFetch({
      "POST bills/bill-1/finalize": (init) => {
        const body = JSON.parse(String(init?.body)) as { tenders: { method: string; amountMinor: number }[] };
        return jsonResponse(
          makeBill({
            status: "finalized",
            finalizedAt: "2026-08-25T10:05:00.000Z",
            tenders: body.tenders.map((t, i) => ({ id: `tender-${i}`, method: t.method as "cash" | "upi_manual", amountMinor: t.amountMinor, createdAt: "2026-08-25T10:05:00.000Z" })),
          }),
        );
      },
    });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", false);

    await userEvent.click(screen.getByTestId("finalize-bill"));
    await screen.findByTestId("bill-finalised-panel");

    const finalizeCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/bills/bill-1/finalize"));
    expect(finalizeCall).toBeTruthy();
    const body = JSON.parse(String(finalizeCall![1]?.body)) as { tenders: unknown[] };
    expect(body.tenders).toHaveLength(1);
  });
});

describe("BillSettleView - discount", () => {
  it("applies a below-threshold discount locally with just a plain reason, no manager PIN dialog, no network call", async () => {
    const fetchMock = stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("bill-add-discount"));
    await screen.findByTestId("discount-dialog");

    await userEvent.click(screen.getByTestId("discount-amount-digit-5"));
    expect(screen.queryByTestId("manager-pin-dialog")).toBeNull();
    await userEvent.type(screen.getByTestId("discount-reason"), "Regular guest");
    await userEvent.click(screen.getByTestId("discount-apply"));

    await waitFor(() => expect(screen.queryByTestId("discount-dialog")).toBeNull());
    // 5% of ₹780.00 subtotal = ₹39.00 off.
    expect(screen.getByText(/Discount — Regular guest/)).toBeTruthy();
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹780.00");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/discount"))).toBe(false);
  });

  it("routes an above-threshold discount through the reused ManagerPinDialog, applied locally until Finalize", async () => {
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("bill-add-discount"));
    await screen.findByTestId("discount-dialog");

    // 25% of ₹780.00 = ₹195.00, above the real 20%-of-subtotal threshold.
    await userEvent.click(screen.getByTestId("discount-amount-digit-2"));
    await userEvent.click(screen.getByTestId("discount-amount-digit-5"));
    expect(screen.getByTestId("discount-requires-approval")).toBeTruthy();
    expect(screen.queryByTestId("discount-reason")).toBeNull();

    await userEvent.click(screen.getByTestId("discount-continue-to-approval"));
    const dialog = await screen.findByTestId("manager-pin-dialog");
    expect(within(dialog).getByTestId("manager-pin-dialog-title").textContent).toContain("Discount above threshold");

    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-1"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-2"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-3"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-4"));
    expect(within(dialog).getByTestId("manager-pin-dialog-confirm")).toHaveProperty("disabled", true);

    await userEvent.selectOptions(within(dialog).getByTestId("manager-pin-dialog-reason-select"), "regular-guest");
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(screen.queryByTestId("manager-pin-dialog")).toBeNull());
    expect(screen.getByText(/Discount — Regular guest/)).toBeTruthy();
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹624.00");
  });
});

describe("BillSettleView - after finalization", () => {
  it("leaves no mutation UI reachable once the bill is finalized, and links to refund with the bill id", async () => {
    stubFetch({
      [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse(makeBill({ status: "finalized", finalizedAt: "2026-08-25T10:05:00.000Z", tenders: [{ id: "t1", method: "cash", amountMinor: 81900, createdAt: "2026-08-25T10:00:00.000Z" }] }), 201),
    });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-finalised-panel");
    expect(screen.queryByTestId("tender-keypad")).toBeNull();
    expect(screen.queryByTestId("finalize-bill")).toBeNull();
    expect(screen.queryByTestId("bill-add-discount")).toBeNull();
    expect(screen.getByTestId("bill-finalised-refund").getAttribute("href")).toBe(`/pos/orders/${ORDER_ID}/refund?billId=bill-1`);
    expect(screen.getByTestId("print-invoice-link").getAttribute("href")).toBe("/pos/bills/bill-1/invoice");
  });
});
