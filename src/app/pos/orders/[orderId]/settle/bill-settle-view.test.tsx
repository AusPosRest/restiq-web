// Component tests for the real P8 bill & settle screen. No live
// restiq-backend to verify against yet (see bill-state.ts's file header), so
// every network call is stubbed against this story's own self-authored
// contract, same convention as order-taking-view.test.tsx/shift-screen.test.tsx.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillSettleView } from "./bill-settle-view";
import type { BillView } from "./bill-state";

const ORDER_ID = "order-1042";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeBill(overrides: Partial<BillView> = {}): BillView {
  return {
    id: "bill-1",
    billNumber: "TN1-000482",
    orderId: ORDER_ID,
    tableLabel: "T4",
    currency: "INR",
    status: "draft",
    lines: [
      {
        id: "line-1",
        itemId: "item-risotto",
        itemName: "Truffle Mushroom Risotto",
        variantId: null,
        variantName: null,
        quantity: 2,
        unitPriceMinor: 39000,
        modifiers: [],
        lineTotalMinor: 78000,
        specialInstructions: null,
        addedByStaffId: "staff-1",
        addedByStaffName: "Asha",
        addedAt: "2026-08-25T09:00:00.000Z",
      },
    ],
    subtotalMinor: 78000,
    discount: null,
    taxLines: [
      { label: "CGST", ratePercent: 2.5, amountMinor: 1950 },
      { label: "SGST", ratePercent: 2.5, amountMinor: 1950 },
    ],
    roundOffMinor: 0,
    grandTotalMinor: 81900,
    tenders: [],
    tenderedMinor: 0,
    remainingMinor: 81900,
    finalisedAt: null,
    ...overrides,
  };
}

let bill: BillView;

function stubFetch(handlers: Partial<Record<string, (init?: RequestInit) => Response>> = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.replace(/^.*\/pos\/api\//, "")}`;

    if (handlers[key]) return Promise.resolve(handlers[key]!(init));

    if (key === `GET orders/${ORDER_ID}/bill`) return Promise.resolve(jsonResponse(bill));
    if (key === `POST orders/${ORDER_ID}/bill/tenders`) {
      const body = JSON.parse(String(init?.body)) as { method: "cash" | "upi"; amountMinor: number };
      bill = {
        ...bill,
        tenders: [...bill.tenders, { id: `tender-${bill.tenders.length + 1}`, method: body.method, amountMinor: body.amountMinor, capturedAt: "2026-08-25T10:00:00.000Z" }],
        tenderedMinor: bill.tenderedMinor + body.amountMinor,
        remainingMinor: Math.max(0, bill.remainingMinor - body.amountMinor),
      };
      return Promise.resolve(jsonResponse(bill));
    }
    if (key === `POST orders/${ORDER_ID}/bill/discount`) {
      const body = JSON.parse(String(init?.body)) as { percentValue: number; reasonCode: string; managerPin?: string };
      const amountMinor = Math.round((bill.subtotalMinor * body.percentValue) / 100);
      bill = {
        ...bill,
        discount: {
          percentValue: body.percentValue,
          amountMinor,
          reasonCode: body.reasonCode,
          reasonLabel: body.reasonCode,
          managerApproved: Boolean(body.managerPin),
        },
        grandTotalMinor: bill.grandTotalMinor - amountMinor,
        remainingMinor: Math.max(0, bill.remainingMinor - amountMinor),
      };
      return Promise.resolve(jsonResponse(bill));
    }
    if (key === `POST orders/${ORDER_ID}/bill/finalize`) {
      bill = { ...bill, status: "finalised", finalisedAt: "2026-08-25T10:05:00.000Z" };
      return Promise.resolve(jsonResponse(bill));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: `unhandled ${key}` } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BillSettleView - tax breakdown", () => {
  it("shows the tax breakdown and grand total from the loaded bill", async () => {
    bill = makeBill();
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByText("CGST 2.5%")).toBeTruthy();
    expect(screen.getByText("SGST 2.5%")).toBeTruthy();
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹819.00");
  });
});

describe("BillSettleView - tenders", () => {
  it("updates the remaining-to-settle figure as tenders are added, across multiple tenders", async () => {
    bill = makeBill();
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("tender-remaining").textContent).toBe("₹819.00");

    // Add a ₹500.00 cash tender (AmountKeypad digits are minor units - paise - so ₹500.00 is "50000").
    for (const digit of ["5", "0", "0", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`tender-keypad-amount-digit-${digit}`));
    }
    await userEvent.click(screen.getByTestId("tender-add"));

    await waitFor(() => expect(screen.getByTestId("tender-remaining").textContent).toBe("₹319.00"));
    expect(screen.getByTestId("tender-captured-list").textContent).toContain("₹500.00");

    // Settle the rest exactly.
    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    await waitFor(() => expect(screen.getByTestId("tender-remaining").textContent).toBe("₹0.00"));
  });
});

describe("BillSettleView - finalize gating", () => {
  it("disables Finalize until tenders exactly cover the grand total, then enables it", async () => {
    bill = makeBill();
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByTestId("tender-fill-remaining"));
    await waitFor(() => expect(screen.getByTestId("finalize-bill")).toHaveProperty("disabled", false));
  });
});

describe("BillSettleView - discount", () => {
  it("applies a below-threshold discount with just a plain reason, no manager PIN dialog", async () => {
    bill = makeBill();
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("bill-add-discount"));
    await screen.findByTestId("discount-dialog");

    await userEvent.click(screen.getByTestId("discount-amount-digit-5"));
    expect(screen.queryByTestId("manager-pin-dialog")).toBeNull();
    await userEvent.type(screen.getByTestId("discount-reason"), "Regular guest");
    await userEvent.click(screen.getByTestId("discount-apply"));

    await waitFor(() => expect(screen.queryByTestId("discount-dialog")).toBeNull());
    expect(screen.getByText(/Discount 5% — Regular guest/)).toBeTruthy();
    expect(screen.queryByText(/Manager approved/)).toBeNull();
  });

  it("routes an above-threshold discount through the reused ManagerPinDialog and only proceeds on approval", async () => {
    bill = makeBill();
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("bill-add-discount"));
    await screen.findByTestId("discount-dialog");

    await userEvent.click(screen.getByTestId("discount-amount-digit-1"));
    await userEvent.click(screen.getByTestId("discount-amount-digit-0"));
    expect(screen.getByTestId("discount-requires-approval")).toBeTruthy();
    expect(screen.queryByTestId("discount-reason")).toBeNull();

    await userEvent.click(screen.getByTestId("discount-continue-to-approval"));
    const dialog = await screen.findByTestId("manager-pin-dialog");
    expect(within(dialog).getByTestId("manager-pin-dialog-title").textContent).toContain("Discount above threshold");

    // PIN entry alone isn't enough - Approve stays disabled until a reason is also picked.
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-1"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-2"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-3"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-4"));
    expect(within(dialog).getByTestId("manager-pin-dialog-confirm")).toHaveProperty("disabled", true);

    await userEvent.selectOptions(within(dialog).getByTestId("manager-pin-dialog-reason-select"), "regular-guest");
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(screen.queryByTestId("manager-pin-dialog")).toBeNull());
    expect(screen.getByText(/Discount 10% — regular-guest \(Manager approved\)/)).toBeTruthy();
  });
});

describe("BillSettleView - after finalisation", () => {
  it("leaves no mutation UI reachable once the bill is finalised", async () => {
    bill = makeBill({ tenders: [{ id: "t1", method: "cash", amountMinor: 81900, capturedAt: "2026-08-25T10:00:00.000Z" }], tenderedMinor: 81900, remainingMinor: 0 });
    stubFetch();
    render(<BillSettleView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    await userEvent.click(screen.getByTestId("finalize-bill"));

    await screen.findByTestId("bill-finalised-panel");
    expect(screen.queryByTestId("tender-keypad")).toBeNull();
    expect(screen.queryByTestId("finalize-bill")).toBeNull();
    // BillSummary only renders the discount trigger at all in draft status -
    // no mutation control of any kind survives finalisation.
    expect(screen.queryByTestId("bill-add-discount")).toBeNull();
  });
});
