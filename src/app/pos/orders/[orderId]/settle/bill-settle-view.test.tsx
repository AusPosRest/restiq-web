// Component tests for the real P8 bill & settle screen, reconciled
// (restiq-web#98) against the real, merged restiq-backend `src/pos/bills/*`
// contract - every stubbed route/shape below is the real one (bills.dtos.ts/
// bills.controller.ts, read directly), not a self-authored guess.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillSettleView } from "./bill-settle-view";
import type { BillView } from "./bill-state";
import type { PaymentIntentView } from "@/lib/payment-intent";
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
    if (key.startsWith("GET shifts/current")) return Promise.resolve(jsonResponse({ id: "shift-1" }));
    if (key === `POST orders/${ORDER_ID}/bill`) return Promise.resolve(jsonResponse(makeBill(), 201));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: `unhandled ${key}` } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
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

  it("explains whose order it is when the bill can't be opened (SE-23)", async () => {
    stubFetch({
      [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse({ error: { code: "not_owner", message: "This order belongs to Asha. Take it over first to make changes." } }, 403),
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await waitFor(() => expect(screen.getByTestId("bill-settle-error").textContent).toContain("This order belongs to Asha"));
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

    for (const digit of ["5", "0", "0"]) {
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

  it("keys whole rupees and shows the amount live while typing (issues #306, #406)", async () => {
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    for (const digit of ["6", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    expect(screen.getByTestId("tender-keypad-amount-display").textContent).toBe("₹60.00");
    await userEvent.click(screen.getByTestId("tender-add"));
    expect(screen.getByTestId("tender-captured-0").textContent).toContain("₹60.00");
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹759.00");
  });

  it("asks before adding cash over 10x what is still due, and Cancel keeps the keyed amount out (issue #406)", async () => {
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    // ₹10,000.00 on an ₹819.00 bill - the classic "keyed cents as rupees" slip.
    for (const digit of ["1", "0", "0", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    await userEvent.click(screen.getByTestId("tender-add"));
    expect(screen.getByTestId("tender-large-cash-confirm").textContent).toContain("₹10,000.00");
    expect(screen.queryByTestId("tender-captured-list")).toBeNull();

    await userEvent.click(screen.getByTestId("tender-large-cash-cancel"));
    expect(screen.queryByTestId("tender-large-cash-confirm")).toBeNull();
    expect(screen.queryByTestId("tender-captured-list")).toBeNull();

    for (const digit of ["1", "0", "0", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    await userEvent.click(screen.getByTestId("tender-add"));
    await userEvent.click(screen.getByTestId("tender-large-cash-accept"));
    expect(screen.getByTestId("tender-captured-0").textContent).toContain("₹10,000.00");
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

describe("BillSettleView - print bill (issues #160, #224)", () => {
  it("sends the open bill straight to the printer - no invoice page in between", async () => {
    const fetchMock = stubFetch({ "POST bills/bill-1/print": () => jsonResponse({ id: "job-1" }, 201) });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    const printBill = screen.getByTestId("print-bill");
    expect(printBill.getAttribute("href")).toBeNull();
    await userEvent.click(printBill);

    await waitFor(() => expect(printBill.textContent).toBe("Sent to printer"));
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/bills/bill-1/print") && init?.method === "POST")).toBe(true);
  });

  it("says so when the print job can't be sent", async () => {
    stubFetch({ "POST bills/bill-1/print": () => jsonResponse({ error: { code: "boom", message: "boom" } }, 500) });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("print-bill"));
    await waitFor(() => expect(screen.getByTestId("print-bill").textContent).toBe("Couldn't send"));
  });
});

describe("BillSettleView - no shift open (restiq-web#341)", () => {
  it("asks the cashier to open a shift before taking cash, but still takes an external payment", async () => {
    const fetchMock = stubFetch({
      [`GET shifts/current?outletId=${encodeURIComponent(rawOrder().outletId)}`]: () => jsonResponse({ error: { code: "not_found", message: "No open shift for this outlet" } }, 404),
    });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("tender-shift-required");
    expect(screen.getByTestId("tender-open-shift").getAttribute("href")).toBe("/pos/shift");
    expect(screen.getByTestId("tender-fill-remaining")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("tender-add")).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByTestId("tender-method-external"));
    expect(screen.queryByTestId("tender-shift-required")).toBeNull();
    await userEvent.type(screen.getByTestId("tender-external-reference"), "EFT-1");
    expect(screen.getByTestId("tender-fill-remaining")).toHaveProperty("disabled", false);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/finalize"))).toBe(false);
  });
});

describe("BillSettleView - external payment (issue #224)", () => {
  it("needs a reference before an external tender can be added, then finalises with it", async () => {
    const fetchMock = stubFetch({
      "POST bills/bill-1/finalize": () => jsonResponse(makeBill({ status: "finalized", finalizedAt: "2026-08-25T10:05:00.000Z" })),
    });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-external"));
    expect(screen.getByTestId("tender-fill-remaining")).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByTestId("tender-external-reference"), "EFT-004512");
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    expect(screen.getByTestId("tender-captured-0").textContent).toContain("External #EFT-004512");

    await userEvent.click(screen.getByTestId("finalize-bill"));
    await screen.findByTestId("bill-finalised-panel");
    const finalizeCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/bills/bill-1/finalize"));
    expect(JSON.parse(String(finalizeCall![1]?.body)).tenders).toEqual([{ method: "external", amountMinor: 81900, reference: "EFT-004512" }]);
  });
});

describe("BillSettleView - finalize", () => {
  it("takes ₹1000 cash on an ₹819 bill, shows ₹181 change and posts the cash net of change (issue #306)", async () => {
    const fetchMock = stubFetch({
      "POST bills/bill-1/finalize": (init) => {
        const body = JSON.parse(String(init?.body)) as { tenders: { method: string; amountMinor: number }[] };
        return jsonResponse(
          makeBill({
            status: "finalized",
            finalizedAt: "2026-08-25T10:05:00.000Z",
            tenders: body.tenders.map((t, i) => ({ id: `tender-${i}`, method: t.method as "cash", amountMinor: t.amountMinor, createdAt: "2026-08-25T10:05:00.000Z" })),
          }),
        );
      },
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    for (const digit of ["1", "0", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    await userEvent.click(screen.getByTestId("tender-add"));
    expect(screen.getByTestId("tender-change-due").textContent).toBe("Change due ₹181.00");
    expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", false);

    await userEvent.click(screen.getByTestId("finalize-bill"));
    expect((await screen.findByTestId("finalised-change-due")).textContent).toBe("Change due ₹181.00");
    const finalizeCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/bills/bill-1/finalize"));
    expect(JSON.parse(String(finalizeCall![1]?.body)).tenders).toEqual([{ method: "cash", amountMinor: 81900 }]);
  });

  it("CU-11: rounds rupee cash to the nearest rupee - ₹1,000 note on a ₹890.40 bill gives ₹110 change; the exact total is posted", async () => {
    const odd = { subtotalMinor: 84800, taxMinor: 4240, totalMinor: 89040 };
    const fetchMock = stubFetch({
      [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse(makeBill(odd), 201),
      "POST bills/bill-1/finalize": (init) => {
        const body = JSON.parse(String(init?.body)) as { tenders: { method: string; amountMinor: number }[] };
        return jsonResponse(
          makeBill({
            ...odd,
            status: "finalized",
            finalizedAt: "2026-08-25T10:05:00.000Z",
            tenders: body.tenders.map((t, i) => ({ id: `tender-${i}`, method: t.method as "cash", amountMinor: t.amountMinor, createdAt: "2026-08-25T10:05:00.000Z" })),
          }),
        );
      },
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    expect(screen.getByTestId("tender-cash-rounded").textContent).toBe("Cash to collect ₹890.00 · round off -₹0.40");
    expect(screen.getByTestId("tender-fill-remaining").textContent).toContain("₹890.00");
    await userEvent.click(screen.getByTestId("tender-quick-note-100000"));
    expect(screen.getByTestId("tender-change-due").textContent).toBe("Change due ₹110.00");

    await userEvent.click(screen.getByTestId("finalize-bill"));
    expect((await screen.findByTestId("finalised-change-due")).textContent).toBe("Change due ₹110.00");
    const finalizeCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/bills/bill-1/finalize"));
    expect(JSON.parse(String(finalizeCall![1]?.body)).tenders).toEqual([{ method: "cash", amountMinor: 89040 }]);
  });

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
  it("leaves no mutation UI or panel actions once the bill is finalized (issue #226)", async () => {
    stubFetch({
      [`POST orders/${ORDER_ID}/bill`]: () => jsonResponse(makeBill({ status: "finalized", finalizedAt: "2026-08-25T10:05:00.000Z", tenders: [{ id: "t1", method: "cash", amountMinor: 81900, createdAt: "2026-08-25T10:00:00.000Z" }] }), 201),
    });
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-finalised-panel");
    expect(screen.queryByTestId("tender-keypad")).toBeNull();
    expect(screen.queryByTestId("finalize-bill")).toBeNull();
    expect(screen.queryByTestId("bill-add-discount")).toBeNull();
    expect(screen.queryByTestId("bill-finalised-back")).toBeNull();
    expect(screen.queryByTestId("bill-finalised-refund")).toBeNull();
    expect(screen.queryByTestId("print-invoice-link")).toBeNull();
  });
});

describe("BillSettleView - card terminal (issue #188)", () => {
  const pending: PaymentIntentView = {
    id: "pi-1",
    billId: "bill-1",
    shareGuestId: null,
    rail: "card_terminal",
    provider: "simulated",
    amountMinor: 81900,
    currency: "INR",
    status: "pending",
    failureReason: null,
    providerRef: null,
    client: { simulated: true },
    createdAt: "2026-09-09T10:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    succeededAt: null,
    tenderId: null,
  };
  const capturedTender = { id: "tender-t1", method: "card_terminal" as const, amountMinor: 81900, paymentIntentId: "pi-1", riskAcknowledged: false, createdAt: "2026-09-09T10:00:30.000Z" };

  it("sends what is still due to the terminal; once it approves, the server-written tender lands on the bill and Finalise goes through with no cashier tender", async () => {
    const fetchMock = stubFetch({
      "POST bills/bill-1/intents": (init) => {
        expect(JSON.parse(String(init?.body))).toMatchObject({ rail: "card_terminal", amountMinor: 81900 });
        return jsonResponse(pending, 201);
      },
      "GET payment-intents/pi-1": () => jsonResponse({ ...pending, status: "succeeded", succeededAt: "2026-09-09T10:00:30.000Z", tenderId: "tender-t1" }),
      "GET bills/bill-1": () => jsonResponse(makeBill({ tenders: [capturedTender] })),
      "POST bills/bill-1/finalize": (init) => {
        expect(JSON.parse(String(init?.body)).tenders).toEqual([]);
        return jsonResponse(makeBill({ status: "finalized", billNumber: 7, finalizedAt: "2026-09-09T10:01:00.000Z", tenders: [capturedTender] }));
      },
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("finalize-bill").hasAttribute("disabled")).toBe(true);

    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));

    const panel = await screen.findByTestId("intent-panel");
    expect(screen.getByTestId("intent-amount").textContent).toBe("₹819.00");
    await waitFor(() => expect(panel.getAttribute("data-phase")).toBe("paid"));
    await userEvent.click(screen.getByTestId("intent-dismiss"));

    expect(screen.getByTestId("tender-captured-server-tender-t1").textContent).toContain("Card terminal");
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹0.00");
    await waitFor(() => expect(screen.getByTestId("finalize-bill").hasAttribute("disabled")).toBe(false));

    await userEvent.click(screen.getByTestId("finalize-bill"));
    await screen.findByTestId("bill-finalised-panel");
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes("bills/bill-1/finalize") && init?.method === "POST")).toBe(true);
  });

  it("brings back a card payment already waiting on the terminal after a reload, with its Cancel (PE-22/CU-13)", async () => {
    stubFetch({ "GET outlets/outlet-1/payment-intents": () => jsonResponse([pending]), "GET payment-intents/pi-1": () => jsonResponse(pending) });
    render(<BillSettleView orderId={ORDER_ID} />);
    const panel = await screen.findByTestId("intent-panel");
    expect(panel.getAttribute("data-phase")).toBe("showing");
    expect(screen.getByTestId("intent-cancel")).toBeTruthy();
  });

  it("shows the server's plain reason when there is no card terminal, and keeps the other ways to pay (PE-22)", async () => {
    const message = "No card terminal is set up for this till. Take the card on your own machine and record it as External, or choose Cash or UPI.";
    stubFetch({ "POST bills/bill-1/intents": () => jsonResponse({ error: { code: "no_terminal", message } }, 409) });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));

    await waitFor(() => expect(screen.getByTestId("intent-error").textContent).toBe(message));
    expect(screen.queryByTestId("intent-panel")).toBeNull();
    expect(screen.getByTestId("tender-method-cash")).toBeTruthy();
    // Issue #407: no terminal for this till - stop offering it, fall back to cash.
    expect(screen.queryByTestId("tender-method-card_terminal")).toBeNull();
    expect(screen.getByTestId("tender-method-cash").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps Card terminal hidden for the rest of the session once the till is known to have none (issue #407)", async () => {
    stubFetch({ "POST bills/bill-1/intents": () => jsonResponse({ error: { code: "no_terminal", message: "No card terminal is set up for this till." } }, 409) });
    const first = render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    await waitFor(() => expect(screen.queryByTestId("tender-method-card_terminal")).toBeNull());
    first.unmount();

    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    expect(screen.queryByTestId("tender-method-card_terminal")).toBeNull();
    expect(screen.getByTestId("tender-method-external")).toBeTruthy();
  });

  it("keeps Finalise disabled while the terminal is still waiting, and a declined card offers a retry with the bill untouched", async () => {
    const partial = { ...pending, amountMinor: 50000 };
    stubFetch({
      "POST bills/bill-1/intents": (init) => {
        expect(JSON.parse(String(init?.body)).amountMinor).toBe(50000);
        return jsonResponse(partial, 201);
      },
      "GET payment-intents/pi-1": () => jsonResponse({ ...partial, status: "failed", failureReason: "declined" }),
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    for (const digit of ["5", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    await userEvent.click(screen.getByTestId("tender-send-terminal"));

    const panel = await screen.findByTestId("intent-panel");
    expect(screen.getByTestId("intent-amount").textContent).toBe("₹500.00");
    await waitFor(() => expect(panel.getAttribute("data-phase")).toBe("retry"));
    expect(screen.getByTestId("intent-status").textContent).toContain("declined");
    expect(screen.queryByTestId("finalize-bill")?.hasAttribute("disabled")).toBe(true);

    await userEvent.click(screen.getByTestId("intent-retry"));
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹819.00");
    expect(screen.queryByTestId("tender-captured-list")).toBeNull();
  });
});

describe("BillSettleView - Stripe card readers (restiq-web#429)", () => {
  const readerIntent: PaymentIntentView = {
    id: "pi-s1",
    billId: "bill-1",
    shareGuestId: null,
    rail: "card_terminal",
    provider: "stripe",
    amountMinor: 81900,
    currency: "INR",
    status: "pending",
    failureReason: null,
    providerRef: "pi_123",
    client: {},
    createdAt: "2026-11-13T10:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    succeededAt: null,
    tenderId: null,
    readerId: "rdr-front",
    readerLabel: "Front counter",
  };
  const front = { id: "rdr-front", outletId: "outlet-1", outletName: "Main", label: "Front counter", deviceType: "stripe_s700", serialNumber: "S1", status: "online", simulated: true };
  const bar = { ...front, id: "rdr-bar", label: "Bar", serialNumber: "S2" };
  const patio = { ...front, id: "rdr-patio", label: "Patio", serialNumber: "S3", status: "offline" };

  it("auto-picks a single reader, sends its id, waits on it, and records the tender like the terminal flow", async () => {
    let polls = 0;
    const captured = { id: "tender-s1", method: "card_terminal" as const, amountMinor: 81900, paymentIntentId: "pi-s1", riskAcknowledged: false, createdAt: "2026-11-13T10:00:30.000Z" };
    stubFetch({
      "GET outlets/outlet-1/card-readers": () => jsonResponse({ readers: [front] }),
      "POST bills/bill-1/intents": (init) => {
        expect(JSON.parse(String(init?.body))).toMatchObject({ rail: "card_terminal", amountMinor: 81900, readerId: "rdr-front" });
        return jsonResponse(readerIntent, 201);
      },
      "GET payment-intents/pi-s1": () => {
        polls += 1;
        return jsonResponse(polls < 2 ? readerIntent : { ...readerIntent, status: "succeeded", tenderId: "tender-s1" });
      },
      "GET bills/bill-1": () => jsonResponse(makeBill({ tenders: [captured] })),
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");

    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    expect((await screen.findByTestId("tender-reader-single")).textContent).toContain("Front counter");
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));

    expect((await screen.findByTestId("intent-reader-waiting")).textContent).toBe("Tap, insert or swipe on Front counter");
    expect(screen.getByTestId("intent-amount").textContent).toBe("₹819.00");
    expect(screen.getByTestId("intent-cancel")).toBeTruthy();

    const panel = screen.getByTestId("intent-panel");
    await waitFor(() => expect(panel.getAttribute("data-phase")).toBe("paid"), { timeout: 4000 });
    await userEvent.click(screen.getByTestId("intent-dismiss"));
    expect(screen.getByTestId("tender-captured-server-tender-s1")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("finalize-bill").hasAttribute("disabled")).toBe(false));
  });

  it("offers a picker with several readers, shows an offline one as unavailable, and sends the chosen one", async () => {
    stubFetch({
      "GET outlets/outlet-1/card-readers": () => jsonResponse({ readers: [front, bar, patio] }),
      "POST bills/bill-1/intents": (init) => {
        expect(JSON.parse(String(init?.body)).readerId).toBe("rdr-bar");
        return jsonResponse({ ...readerIntent, readerId: "rdr-bar", readerLabel: "Bar" }, 201);
      },
      "GET payment-intents/pi-s1": () => jsonResponse({ ...readerIntent, readerId: "rdr-bar", readerLabel: "Bar" }),
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));

    expect((await screen.findByTestId("tender-reader-rdr-front")).getAttribute("aria-pressed")).toBe("true");
    const offline = screen.getByTestId("tender-reader-rdr-patio");
    expect(offline.hasAttribute("disabled")).toBe(true);
    expect(offline.textContent).toContain("offline");

    await userEvent.click(screen.getByTestId("tender-reader-rdr-bar"));
    expect(screen.getByTestId("tender-reader-rdr-bar").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    expect((await screen.findByTestId("intent-reader-waiting")).textContent).toBe("Tap, insert or swipe on Bar");
  });

  it("can't send when the only reader is offline", async () => {
    stubFetch({ "GET outlets/outlet-1/card-readers": () => jsonResponse({ readers: [patio] }) });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    expect((await screen.findByTestId("tender-reader-single")).textContent).toContain("offline");
    expect(screen.getByTestId("tender-fill-remaining").hasAttribute("disabled")).toBe(true);
  });

  it("simulates a decline in sandbox, shows Stripe's reason, and Retry re-sends the same amount", async () => {
    const declined = { ...readerIntent, status: "failed" as const, failureReason: "Your card was declined." };
    let created = 0;
    let declinedYet = false;
    stubFetch({
      "GET outlets/outlet-1/card-readers": () => jsonResponse({ readers: [front] }),
      "POST bills/bill-1/intents": (init) => {
        created += 1;
        expect(JSON.parse(String(init?.body))).toMatchObject({ amountMinor: 81900, readerId: "rdr-front" });
        return jsonResponse(created === 1 ? readerIntent : { ...readerIntent, id: "pi-s2" }, 201);
      },
      "GET payment-intents/pi-s1": () => jsonResponse(declinedYet ? declined : readerIntent),
      "GET payment-intents/pi-s2": () => jsonResponse({ ...readerIntent, id: "pi-s2" }),
      "POST payment-intents/pi-s1/simulate": (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ outcome: "failure" });
        declinedYet = true;
        return jsonResponse(declined);
      },
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    await screen.findByTestId("tender-reader-single");
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));

    await userEvent.click(await screen.findByTestId("intent-simulate-decline"));
    expect((await screen.findByTestId("intent-failure-reason")).textContent).toBe("Your card was declined.");
    expect(screen.getByTestId("intent-retry").textContent).toBe("Use another method");

    await userEvent.click(screen.getByTestId("intent-reader-retry"));
    await waitFor(() => expect(created).toBe(2));
    await screen.findByTestId("intent-reader-waiting");
  });

  it("hides the simulate buttons after a 404 (live key)", async () => {
    stubFetch({
      "GET outlets/outlet-1/card-readers": () => jsonResponse({ readers: [front] }),
      "POST bills/bill-1/intents": () => jsonResponse(readerIntent, 201),
      "GET payment-intents/pi-s1": () => jsonResponse(readerIntent),
      "POST payment-intents/pi-s1/simulate": () => jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404),
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    await screen.findByTestId("tender-reader-single");
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));

    await userEvent.click(await screen.findByTestId("intent-simulate-approve"));
    await waitFor(() => expect(screen.queryByTestId("intent-simulate-approve")).toBeNull());
    expect(screen.queryByTestId("intent-error")).toBeNull();
    expect(screen.getByTestId("intent-reader-waiting")).toBeTruthy();
  });

  it("Cancel on a reader intent calls the existing cancel", async () => {
    const fetchMock = stubFetch({
      "GET outlets/outlet-1/card-readers": () => jsonResponse({ readers: [front] }),
      "POST bills/bill-1/intents": () => jsonResponse(readerIntent, 201),
      "GET payment-intents/pi-s1": () => jsonResponse(readerIntent),
      "POST payment-intents/pi-s1/cancel": () => jsonResponse({ ...readerIntent, status: "cancelled" }),
    });
    render(<BillSettleView orderId={ORDER_ID} />);
    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("tender-method-card_terminal"));
    await screen.findByTestId("tender-reader-single");
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    await userEvent.click(await screen.findByTestId("intent-cancel"));

    await waitFor(() => expect(screen.getByTestId("intent-panel").getAttribute("data-phase")).toBe("retry"));
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes("payment-intents/pi-s1/cancel") && init?.method === "POST")).toBe(true);
  });
});
