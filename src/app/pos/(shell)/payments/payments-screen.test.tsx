// Payments today (issue #253): renders the backend's per-method totals and
// rows newest-first as served, shows the empty state honestly, and retries.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentHistoryView } from "../../api";
import { PaymentsScreen } from "./payments-screen";

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
    expect(screen.getByTestId("pos-payments-summary").textContent).toBe("3 payments · ₹420.00 · 2026-09-16");
    expect(screen.getByTestId("pos-payments-total-cash").textContent).toContain("₹210.00");
    expect(screen.getByTestId("pos-payments-total-external").textContent).toContain("External");

    const rows = screen.getAllByTestId(/^pos-payment-row-/).map((row) => row.getAttribute("data-testid"));
    expect(rows).toEqual(["pos-payment-row-t3", "pos-payment-row-t2", "pos-payment-row-t1"]);
    expect(screen.getByTestId("pos-payment-row-t1").textContent).toContain("#1 · T1");
    expect(screen.getByTestId("pos-payment-row-t1").textContent).toContain("Asha");
    expect(screen.getByTestId("pos-payment-row-t3").textContent).toContain("#2 · Token 14");
    expect(screen.getByTestId("pos-payment-row-t3").textContent).toContain("EFT-1");
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
