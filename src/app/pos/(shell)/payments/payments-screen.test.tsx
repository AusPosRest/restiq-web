// Payments today (issue #253): renders the backend's per-method totals and
// rows newest-first as served, shows the empty state honestly, and retries.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentHistoryView } from "../../api";
import { methodLabel, PaymentsScreen } from "./payments-screen";

const OUTLET_ID = "outlet-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const VIEW: PaymentHistoryView = {
  outletId: OUTLET_ID,
  date: "2026-09-16",
  asOf: "2026-09-16T09:32:00.000Z",
  currency: "INR",
  totalMinor: 42000,
  count: 3,
  byMethod: [
    { method: "cash", count: 1, amountMinor: 21000 },
    { method: "upi_manual", count: 1, amountMinor: 11000 },
    { method: "external", count: 1, amountMinor: 10000 },
  ],
  payments: [
    { id: "t3", billId: "b2", billNumber: 2, orderId: "o2", tableLabel: null, tokenNumber: 14, method: "external", amountMinor: 10000, reference: "EFT-1", takenBy: { staffId: "s2", name: "Ravi" }, createdAt: "2026-09-16T09:30:00.000Z" },
    { id: "t2", billId: "b2", billNumber: 2, orderId: "o2", tableLabel: null, tokenNumber: 14, method: "upi_manual", amountMinor: 11000, reference: null, takenBy: { staffId: "s2", name: "Ravi" }, createdAt: "2026-09-16T09:30:00.000Z" },
    { id: "t1", billId: "b1", billNumber: 1, orderId: "o1", tableLabel: "T1", tokenNumber: null, method: "cash", amountMinor: 21000, reference: null, takenBy: { staffId: "s1", name: "Asha" }, createdAt: "2026-09-16T08:10:00.000Z" },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PaymentsScreen", () => {
  it("renders totals per method and the rows as served", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        expect(String(input)).toBe(`/pos/api/outlets/${OUTLET_ID}/payments`);
        return Promise.resolve(jsonResponse(VIEW));
      }),
    );
    render(<PaymentsScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("pos-payments-content")).toBeTruthy();
    expect(screen.getByTestId("pos-payments-summary").textContent).toBe("3 payments · ₹420.00 · 16 Sept 2026");
    expect(screen.getByTestId("pos-payments-total-cash").textContent).toContain("₹210.00");
    expect(screen.getByTestId("pos-payments-total-external").textContent).toContain("External");

    const rows = screen.getAllByTestId(/^pos-payment-row-/).map((row) => row.getAttribute("data-testid"));
    expect(rows).toEqual(["pos-payment-row-t3", "pos-payment-row-t2", "pos-payment-row-t1"]);
    expect(screen.getByTestId("pos-payment-row-t1").textContent).toContain("#1 · T1");
    expect(screen.getByTestId("pos-payment-row-t1").textContent).toContain("Asha");
    expect(screen.getByTestId("pos-payment-row-t3").textContent).toContain("#2 · Token 14");
    expect(screen.getByTestId("pos-payment-row-t3").textContent).toContain("EFT-1");
  });

  it("offers Refund once per finalised bill, linking to that bill's refund screen (issue #405)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(VIEW)));
    render(<PaymentsScreen outletId={OUTLET_ID} />);
    await screen.findByTestId("pos-payments-content");

    const links = screen.getAllByTestId(/^pos-payment-refund-/);
    expect(links.map((link) => link.getAttribute("data-testid"))).toEqual(["pos-payment-refund-b2", "pos-payment-refund-b1"]);
    expect(screen.getByTestId("pos-payment-refund-b2").getAttribute("href")).toBe("/pos/orders/o2/refund?billId=b2");
    expect(screen.getByTestId("pos-payment-row-t3").contains(screen.getByTestId("pos-payment-refund-b2"))).toBe(true);
  });

  // restiq-web#386: card payments that landed after the bill was already paid.
  const REFUNDS_DUE = [
    { id: "pi1", billId: "b9", billNumber: 9, orderId: "o9", tableLabel: "T4", tokenNumber: null, method: "card_online", amountMinor: 35000, flaggedAt: "2026-09-15T10:05:00.000Z" },
    { id: "pi2", billId: "b8", billNumber: null, orderId: "o8", tableLabel: null, tokenNumber: 21, method: "card_terminal", amountMinor: 12050, flaggedAt: "2026-09-14T18:40:00.000Z" },
  ];

  it("lists refunds owed above the totals and table (restiq-web#386)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...VIEW, refundsDue: REFUNDS_DUE })));
    render(<PaymentsScreen outletId={OUTLET_ID} />);
    const panel = await screen.findByTestId("pos-payments-refunds-due");

    expect(panel.getAttribute("role")).toBe("status");
    expect(screen.getByTestId("pos-payments-refunds-due-count").textContent).toContain("2");
    expect(panel.textContent).toContain("Refund each one in your card provider's dashboard.");
    const first = screen.getByTestId("pos-payments-refund-due-pi1").textContent ?? "";
    expect(first).toContain("Bill #9");
    expect(first).toContain("Table T4");
    expect(first).toContain(methodLabel("card_online"));
    expect(first).toContain("₹350.00");
    expect(first).toContain("15 Sept");
    const second = screen.getByTestId("pos-payments-refund-due-pi2").textContent ?? "";
    expect(second).not.toContain("Bill #");
    expect(second).toContain("Token 21");
    expect(second).toContain("₹120.50");

    // Above the totals and the table, which are unchanged.
    const totals = screen.getByTestId("pos-payments-totals");
    expect(panel.compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("pos-payments-total-cash").textContent).toContain("₹210.00");
    expect(screen.getAllByTestId(/^pos-payment-row-/)).toHaveLength(3);
  });

  it("shows no refunds panel when refundsDue is empty or missing (restiq-web#386)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ ...VIEW, refundsDue: [] })).mockResolvedValueOnce(jsonResponse(VIEW)));
    const { unmount } = render(<PaymentsScreen outletId={OUTLET_ID} />);
    await screen.findByTestId("pos-payments-content");
    expect(screen.queryByTestId("pos-payments-refunds-due")).toBeNull();
    unmount();
    render(<PaymentsScreen outletId={OUTLET_ID} />);
    await screen.findByTestId("pos-payments-content");
    expect(screen.queryByTestId("pos-payments-refunds-due")).toBeNull();
  });

  it("shows the empty state when nothing has been taken today", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...VIEW, totalMinor: 0, count: 0, byMethod: [], payments: [] })));
    render(<PaymentsScreen outletId={OUTLET_ID} />);
    expect(await screen.findByTestId("pos-payments-empty")).toBeTruthy();
    expect(screen.queryByTestId("pos-payments-totals")).toBeNull();
  });

  it("offers retry on failure and reloads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: { code: "boom", message: "nope" } }, 500)).mockResolvedValueOnce(jsonResponse(VIEW));
    vi.stubGlobal("fetch", fetchMock);
    render(<PaymentsScreen outletId={OUTLET_ID} />);
    expect(await screen.findByTestId("pos-payments-load-error")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByTestId("pos-payments-content")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
