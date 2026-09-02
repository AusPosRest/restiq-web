// Component tests for the real P10 refund & adjustments screen, reconciled
// (restiq-web#98) against the real, merged restiq-backend `src/pos/bills/*`
// contract - every stubbed route/shape below is the real one (bills.dtos.ts/
// bills.controller.ts, read directly), not a self-authored guess.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefundView } from "./refund-view";
import type { BillView } from "../settle/bill-state";
import type { PosMenuView, RawOrder } from "../order-taking-state";

const ORDER_ID = "order-1042";
const BILL_ID = "bill-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const MENU: PosMenuView = {
  currency: "INR",
  categories: [{ id: "cat-mains", name: "Mains", sortOrder: 0 }],
  items: [
    { id: "item-butter-naan", categoryId: "cat-mains", name: "Butter Naan", shortName: "Naan", available: true, priceMinor: 6000, variants: [], modifierGroups: [] },
    { id: "item-paneer-tikka", categoryId: "cat-mains", name: "Paneer Tikka", shortName: "Paneer", available: true, priceMinor: 32000, variants: [], modifierGroups: [] },
  ],
};

function rawOrder(): RawOrder {
  return {
    id: ORDER_ID,
    tenantId: "tenant-1",
    outletId: "outlet-1",
    tableId: "table-12",
    ownerId: "staff-1",
    status: "closed",
    tokenNumber: null,
    createdAt: "2026-08-24T14:00:00.000Z",
    updatedAt: "2026-08-24T14:22:00.000Z",
    lines: [
      {
        id: "line-naan",
        orderId: ORDER_ID,
        itemId: "item-butter-naan",
        variantId: null,
        quantity: 2,
        unitPriceMinor: 6000,
        seatNumber: null,
        addedByStaffId: "staff-1",
        createdAt: "2026-08-24T14:05:00.000Z",
        modifiers: [],
      },
      {
        id: "line-paneer",
        orderId: ORDER_ID,
        itemId: "item-paneer-tikka",
        variantId: null,
        quantity: 1,
        unitPriceMinor: 32000,
        seatNumber: null,
        addedByStaffId: "staff-1",
        createdAt: "2026-08-24T14:06:00.000Z",
        modifiers: [],
      },
    ],
  };
}

function makeFinalizedBill(overrides: Partial<BillView> = {}): BillView {
  return {
    id: BILL_ID,
    orderId: ORDER_ID,
    billNumber: 482,
    status: "finalized",
    subtotalMinor: 72000,
    taxMinor: 3600,
    discountMinor: null,
    discountReason: null,
    totalMinor: 75600,
    createdAt: "2026-08-24T14:10:00.000Z",
    finalizedAt: "2026-08-24T14:22:00.000Z",
    tenders: [
      { id: "tender-1", method: "cash", amountMinor: 50000, createdAt: "2026-08-24T14:22:00.000Z" },
      { id: "tender-2", method: "upi_manual", amountMinor: 25600, createdAt: "2026-08-24T14:22:00.000Z" },
    ],
    ...overrides,
  };
}

let bill: BillView;
let refundRequests: Array<{ lines?: { orderLineId: string; quantity: number }[]; reason: string; managerPin: string }>;

function stubFetch(options: { rejectPin?: string } = {}) {
  refundRequests = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.replace(/^.*\/pos\/api\//, "")}`;

    if (key === "GET menu") return Promise.resolve(jsonResponse(MENU));
    if (key === `GET orders/${ORDER_ID}`) return Promise.resolve(jsonResponse(rawOrder()));
    if (key === `GET bills/${BILL_ID}`) return Promise.resolve(jsonResponse(bill));

    if (key === `POST bills/${BILL_ID}/refund`) {
      const body = JSON.parse(String(init?.body)) as { lines?: { orderLineId: string; quantity: number }[]; reason: string; managerPin: string };
      refundRequests.push(body);

      if (options.rejectPin && body.managerPin === options.rejectPin) {
        return Promise.resolve(jsonResponse({ error: { code: "invalid_pin", message: "Incorrect manager PIN." } }, 401));
      }

      const order = rawOrder();
      const lines = body.lines ?? [];
      const subtotalMinor = lines.reduce((sum, l) => {
        const line = order.lines.find((candidate) => candidate.id === l.orderLineId)!;
        return sum + line.unitPriceMinor * l.quantity;
      }, 0);
      const taxMinor = Math.round(subtotalMinor * 0.05);
      return Promise.resolve(
        jsonResponse(
          {
            id: "credit-note-1",
            originalBillId: bill.id,
            reason: body.reason,
            approvedByStaffId: "manager-1",
            createdByStaffId: "staff-1",
            subtotalMinor,
            taxMinor,
            totalMinor: subtotalMinor + taxMinor,
            createdAt: "2026-08-25T10:00:00.000Z",
            lines: lines.map((l) => {
              const line = order.lines.find((candidate) => candidate.id === l.orderLineId)!;
              return { id: `cn-${l.orderLineId}`, orderLineId: l.orderLineId, quantity: l.quantity, unitPriceMinor: line.unitPriceMinor, amountMinor: line.unitPriceMinor * l.quantity };
            }),
          },
          201,
        ),
      );
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

describe("RefundView - no bill id", () => {
  it("directs back to Settle instead of guessing at a bill id", async () => {
    stubFetch();
    render(<RefundView orderId={ORDER_ID} billId={null} />);
    expect(await screen.findByTestId("refund-no-bill")).toBeTruthy();
  });
});

describe("RefundView - selecting items to refund", () => {
  it("computes the correct partial refund amount as items/quantities are selected", async () => {
    bill = makeFinalizedBill();
    stubFetch();
    render(<RefundView orderId={ORDER_ID} billId={BILL_ID} />);

    await screen.findByTestId("refund-config-panel");
    expect(screen.getByTestId("refund-total-value").textContent).toBe("₹0.00");

    await userEvent.click(screen.getByTestId("refund-line-select-line-naan"));
    // Selecting defaults to the line's full original quantity (2 x Rs60 = Rs120, +5% tax = Rs126).
    expect(screen.getByTestId("refund-line-qty-line-naan").textContent).toBe("2");
    expect(screen.getByTestId("refund-total-value").textContent).toBe("₹126.00");

    // Reduce to a partial quantity of 1: Rs60 subtotal, Rs3 tax, Rs63 total.
    await userEvent.click(screen.getByTestId("refund-line-decrement-line-naan"));
    expect(screen.getByTestId("refund-line-qty-line-naan").textContent).toBe("1");
    expect(screen.getByTestId("refund-total-value").textContent).toBe("₹63.00");

    // Adding the second item on top: +Rs320 subtotal, +5% tax = +Rs336, running total Rs399.
    await userEvent.click(screen.getByTestId("refund-line-select-line-paneer"));
    expect(screen.getByTestId("refund-total-value").textContent).toBe("₹399.00");
  });

  it("only shows the original bill (never mutated) and the finalized bill's own totals throughout selection", async () => {
    bill = makeFinalizedBill();
    stubFetch();
    render(<RefundView orderId={ORDER_ID} billId={BILL_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("bill-status").textContent).toBe("Finalized");
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹756.00");
    // BillSummary hides its own discount/edit affordance once finalized.
    expect(screen.queryByTestId("bill-add-discount")).toBeNull();

    await userEvent.click(screen.getByTestId("refund-line-select-line-naan"));
    // Selecting a refund line never changes the original invoice's own totals.
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹756.00");
  });
});

describe("RefundView - manager PIN gate", () => {
  it("blocks the refund until the manager PIN dialog approves it", async () => {
    bill = makeFinalizedBill();
    const fetchMock = stubFetch();
    render(<RefundView orderId={ORDER_ID} billId={BILL_ID} />);

    await screen.findByTestId("refund-config-panel");
    await userEvent.click(screen.getByTestId("refund-line-select-line-naan"));
    await userEvent.click(screen.getByTestId("process-refund"));

    const dialog = await screen.findByTestId("manager-pin-dialog");
    expect(within(dialog).getByTestId("manager-pin-dialog-title").textContent).toContain("Refund");

    // No refund call has been made yet - the dialog only collects PIN + reason so far.
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").length).toBe(0);
    expect(within(dialog).getByTestId("manager-pin-dialog-confirm")).toHaveProperty("disabled", true);

    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-1"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-2"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-3"));
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-digit-4"));
    // PIN alone still isn't enough - a reason code is mandatory too.
    expect(within(dialog).getByTestId("manager-pin-dialog-confirm")).toHaveProperty("disabled", true);

    await userEvent.selectOptions(within(dialog).getByTestId("manager-pin-dialog-reason-select"), "customer-complaint");
    expect(within(dialog).getByTestId("manager-pin-dialog-confirm")).toHaveProperty("disabled", false);

    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(screen.queryByTestId("manager-pin-dialog")).toBeNull());
    expect(refundRequests).toHaveLength(1);
    expect(refundRequests[0]).toMatchObject({ reason: "Customer complaint", managerPin: "1234" });
  });

  it("keeps a rejected PIN from proceeding - the refund never lands and the config panel stays put", async () => {
    bill = makeFinalizedBill();
    stubFetch({ rejectPin: "0000" });
    render(<RefundView orderId={ORDER_ID} billId={BILL_ID} />);

    await screen.findByTestId("refund-config-panel");
    await userEvent.click(screen.getByTestId("refund-line-select-line-naan"));
    await userEvent.click(screen.getByTestId("process-refund"));

    const dialog = await screen.findByTestId("manager-pin-dialog");
    for (const digit of "0000") {
      await userEvent.click(within(dialog).getByTestId(`manager-pin-dialog-digit-${digit}`));
    }
    await userEvent.selectOptions(within(dialog).getByTestId("manager-pin-dialog-reason-select"), "customer-complaint");
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-confirm"));

    await screen.findByTestId("manager-pin-dialog-error");
    // The dialog stays open with the error surfaced, no credit note was issued.
    expect(screen.getByTestId("manager-pin-dialog")).toBeTruthy();
    expect(screen.queryByTestId("credit-note-result")).toBeNull();
    expect(screen.getByTestId("refund-config-panel")).toBeTruthy();
  });
});

describe("RefundView - successful refund", () => {
  it("shows the resulting credit note and leaves the original bill's display unchanged", async () => {
    bill = makeFinalizedBill();
    const fetchMock = stubFetch();
    render(<RefundView orderId={ORDER_ID} billId={BILL_ID} />);

    await screen.findByTestId("refund-config-panel");
    await userEvent.click(screen.getByTestId("refund-line-select-line-naan"));
    await userEvent.click(screen.getByTestId("process-refund"));

    const dialog = await screen.findByTestId("manager-pin-dialog");
    for (const digit of "1234") {
      await userEvent.click(within(dialog).getByTestId(`manager-pin-dialog-digit-${digit}`));
    }
    await userEvent.selectOptions(within(dialog).getByTestId("manager-pin-dialog-reason-select"), "customer-complaint");
    await userEvent.click(within(dialog).getByTestId("manager-pin-dialog-confirm"));

    await screen.findByTestId("credit-note-result");
    expect(screen.getByTestId("credit-note-number").textContent).toContain("credit-note-1");
    expect(screen.getByTestId("credit-note-total").textContent).toBe("₹126.00");
    // The original, finalized bill is never re-fetched or shown as edited -
    // the read-only invoice view is simply swapped out.
    expect(screen.queryByTestId("bill-summary")).toBeNull();
    // No PUT/PATCH ever touched the bill itself - only the insert-only refund POST.
    const mutatingBillCalls = fetchMock.mock.calls.filter(([input, init]) => {
      const url = String(input);
      return (init?.method === "PATCH" || init?.method === "PUT") && url.includes("/bill");
    });
    expect(mutatingBillCalls).toHaveLength(0);
  });
});

describe("RefundView - ineligible bill", () => {
  it("refuses to show refund controls for a bill that isn't finalized yet", async () => {
    bill = makeFinalizedBill({ status: "open", finalizedAt: null });
    stubFetch();
    render(<RefundView orderId={ORDER_ID} billId={BILL_ID} />);

    await screen.findByTestId("refund-not-eligible");
    expect(screen.queryByTestId("refund-config-panel")).toBeNull();
  });
});
