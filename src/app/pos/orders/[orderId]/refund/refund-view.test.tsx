// Component tests for the real P10 refund & adjustments screen. No live
// restiq-backend to verify against yet (see refund-state.ts's file header),
// so every network call is stubbed against this story's own self-authored
// contract, same convention as bill-settle-view.test.tsx.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefundView } from "./refund-view";
import type { BillView } from "../settle/bill-state";

const ORDER_ID = "order-1042";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeFinalisedBill(overrides: Partial<BillView> = {}): BillView {
  return {
    id: "bill-1",
    billNumber: "TN1-000482",
    orderId: ORDER_ID,
    tableLabel: "Table 12",
    currency: "INR",
    status: "finalised",
    lines: [
      {
        id: "line-naan",
        itemId: "item-butter-naan",
        itemName: "Butter Naan",
        variantId: null,
        variantName: null,
        quantity: 2,
        unitPriceMinor: 6000,
        modifiers: [],
        lineTotalMinor: 12000,
        specialInstructions: null,
        addedByStaffId: "staff-1",
        addedByStaffName: "Arjun",
        addedAt: "2026-08-24T14:22:00.000Z",
      },
      {
        id: "line-paneer",
        itemId: "item-paneer-tikka",
        itemName: "Paneer Tikka",
        variantId: null,
        variantName: null,
        quantity: 1,
        unitPriceMinor: 32000,
        modifiers: [],
        lineTotalMinor: 32000,
        specialInstructions: null,
        addedByStaffId: "staff-1",
        addedByStaffName: "Arjun",
        addedAt: "2026-08-24T14:22:00.000Z",
      },
    ],
    subtotalMinor: 72000,
    discount: null,
    taxLines: [
      { label: "CGST", ratePercent: 2.5, amountMinor: 1800 },
      { label: "SGST", ratePercent: 2.5, amountMinor: 1800 },
    ],
    roundOffMinor: 0,
    grandTotalMinor: 75600,
    tenders: [
      { id: "tender-1", method: "cash", amountMinor: 50000, capturedAt: "2026-08-24T14:22:00.000Z" },
      { id: "tender-2", method: "upi", amountMinor: 25600, capturedAt: "2026-08-24T14:22:00.000Z" },
    ],
    tenderedMinor: 75600,
    remainingMinor: 0,
    finalisedAt: "2026-08-24T14:22:00.000Z",
    ...overrides,
  };
}

let bill: BillView;
let refundRequests: Array<{ lines: { lineId: string; quantity: number }[]; reasonCode: string; managerPin: string; refundMethod: string; notes?: string }>;

function stubFetch(options: { rejectPin?: string } = {}) {
  refundRequests = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${url.replace(/^.*\/pos\/api\//, "")}`;

    if (key === `GET orders/${ORDER_ID}/bill`) return Promise.resolve(jsonResponse(bill));

    if (key === `POST orders/${ORDER_ID}/bill/refund`) {
      const body = JSON.parse(String(init?.body)) as {
        lines: { lineId: string; quantity: number }[];
        reasonCode: string;
        managerPin: string;
        refundMethod: "cash" | "upi";
        notes?: string;
      };
      refundRequests.push(body);

      if (options.rejectPin && body.managerPin === options.rejectPin) {
        return Promise.resolve(jsonResponse({ error: { code: "invalid_pin", message: "Incorrect manager PIN." } }, 401));
      }

      const subtotalMinor = body.lines.reduce((sum, l) => {
        const line = bill.lines.find((candidate) => candidate.id === l.lineId)!;
        return sum + line.unitPriceMinor * l.quantity;
      }, 0);
      const taxReversalMinor = Math.round(subtotalMinor * 0.05);
      return Promise.resolve(
        jsonResponse({
          id: "credit-note-1",
          creditNoteNumber: "CN-TN1-000482-01",
          billId: bill.id,
          billNumber: bill.billNumber,
          orderId: ORDER_ID,
          currency: bill.currency,
          lines: body.lines.map((l) => {
            const line = bill.lines.find((candidate) => candidate.id === l.lineId)!;
            return {
              id: `cn-${l.lineId}`,
              lineId: l.lineId,
              itemName: line.itemName,
              variantName: line.variantName,
              quantity: l.quantity,
              unitPriceMinor: line.unitPriceMinor,
              amountMinor: line.unitPriceMinor * l.quantity,
            };
          }),
          subtotalMinor,
          taxReversalMinor,
          totalMinor: subtotalMinor + taxReversalMinor,
          refundMethod: body.refundMethod,
          reasonCode: body.reasonCode,
          reasonLabel: body.reasonCode,
          notes: body.notes ?? null,
          issuedAt: "2026-08-25T10:00:00.000Z",
        }),
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

describe("RefundView - selecting items to refund", () => {
  it("computes the correct partial refund amount as items/quantities are selected", async () => {
    bill = makeFinalisedBill();
    stubFetch();
    render(<RefundView orderId={ORDER_ID} />);

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

  it("only shows the original bill (never mutated) and the finalised bill's own totals throughout selection", async () => {
    bill = makeFinalisedBill();
    stubFetch();
    render(<RefundView orderId={ORDER_ID} />);

    await screen.findByTestId("bill-summary");
    expect(screen.getByTestId("bill-status").textContent).toBe("Finalised");
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹756.00");
    // BillSummary hides its own discount/edit affordance once finalised.
    expect(screen.queryByTestId("bill-add-discount")).toBeNull();

    await userEvent.click(screen.getByTestId("refund-line-select-line-naan"));
    // Selecting a refund line never changes the original invoice's own totals.
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹756.00");
  });
});

describe("RefundView - manager PIN gate", () => {
  it("blocks the refund until the manager PIN dialog approves it", async () => {
    bill = makeFinalisedBill();
    const fetchMock = stubFetch();
    render(<RefundView orderId={ORDER_ID} />);

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
    expect(refundRequests[0]).toMatchObject({ reasonCode: "customer-complaint", managerPin: "1234" });
  });

  it("keeps a rejected PIN from proceeding - the refund never lands and the config panel stays put", async () => {
    bill = makeFinalisedBill();
    stubFetch({ rejectPin: "0000" });
    render(<RefundView orderId={ORDER_ID} />);

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
    bill = makeFinalisedBill();
    const fetchMock = stubFetch();
    render(<RefundView orderId={ORDER_ID} />);

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
    expect(screen.getByTestId("credit-note-number").textContent).toContain("TN1-000482");
    expect(screen.getByTestId("credit-note-total").textContent).toBe("₹126.00");
    // The original, finalised bill is never re-fetched or shown as edited -
    // the read-only invoice view is simply swapped out, and only one GET was
    // ever issued for it.
    expect(screen.queryByTestId("bill-summary")).toBeNull();
    const getCalls = fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET");
    expect(getCalls).toHaveLength(1);
    // No PUT/PATCH ever touched the bill itself - only the insert-only refund POST.
    const mutatingBillCalls = fetchMock.mock.calls.filter(([input, init]) => {
      const url = String(input);
      return (init?.method === "PATCH" || init?.method === "PUT") && url.includes("/bill");
    });
    expect(mutatingBillCalls).toHaveLength(0);
  });
});

describe("RefundView - ineligible bill", () => {
  it("refuses to show refund controls for a bill that isn't finalised yet", async () => {
    bill = makeFinalisedBill({ status: "draft", finalisedAt: null });
    stubFetch();
    render(<RefundView orderId={ORDER_ID} />);

    await screen.findByTestId("refund-not-eligible");
    expect(screen.queryByTestId("refund-config-panel")).toBeNull();
  });
});
