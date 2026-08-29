import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutScreen } from "./checkout-screen";
import type { GuestBillView } from "./checkout-api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function routedFetch(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  return vi.fn((url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unhandled fetch: ${key}`);
    return Promise.resolve(handler());
  });
}

const TWO_GUEST_BILL: GuestBillView = {
  id: "b1",
  orderId: "o1",
  billNumber: null,
  subtotalMinor: 50000,
  taxMinor: 2500,
  discountMinor: null,
  discountReason: null,
  totalMinor: 52500,
  status: "open",
  createdAt: "2026-08-29T10:00:00.000Z",
  finalizedAt: null,
  tenders: [],
  shares: [
    { guestId: "g1", guestName: "Ananya", amountMinor: 26250, status: "outstanding", payerPhone: null, paidAt: null },
    { guestId: "g2", guestName: "Rohan", amountMinor: 26250, status: "outstanding", payerPhone: null, paidAt: null },
  ],
};

describe("CheckoutScreen", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows a no-order state when no orderId is given, with nothing fetched", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("should not fetch without an orderId");
      }),
    );
    render(<CheckoutScreen orderId={null} myGuestId="g1" />);
    expect(screen.getByTestId("checkout-no-order")).toBeTruthy();
  });

  it("create-or-fetch convergence: a 409 bill_already_exists on create falls back to GET, not an error", async () => {
    const fetchMock = routedFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(409, { error: { code: "bill_already_exists", message: "A bill already exists for this order" } }),
      "GET /qr/api/orders/o1/bill": () => jsonResponse(200, TWO_GUEST_BILL),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    expect(await screen.findByTestId("checkout-bill-summary")).toBeTruthy();
    expect(screen.getByTestId("checkout-total").textContent).toBe("₹525.00");

    const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
    expect(calls[0]).toEqual(["/qr/api/orders/o1/bill", expect.objectContaining({ method: "POST" })]);
    expect(calls[1][0]).toBe("/qr/api/orders/o1/bill");
    expect(calls[1][1]?.method).toBeUndefined();
  });

  it("renders every guest's share, with the caller's own row emphasized and the only one offering a pay action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, TWO_GUEST_BILL)));
    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    await screen.findByTestId("checkout-share-g1");
    expect(screen.getByTestId("checkout-share-g1").querySelector('[data-testid="guest-chip-mine"]')).toBeTruthy();
    expect(screen.getByTestId("checkout-share-g2").querySelector('[data-testid="guest-chip-mine"]')).toBeNull();

    // Only the caller's own outstanding row exposes a Pay action.
    expect(screen.getAllByTestId("checkout-pay-own")).toHaveLength(1);
    expect(screen.getByTestId("checkout-share-outstanding-g2")).toBeTruthy();
    expect(screen.getByTestId("checkout-share-g2").querySelector("button")).toBeNull();
  });

  it("a successful simulated payment for the caller's own share marks it paid", async () => {
    const paidBill: GuestBillView = {
      ...TWO_GUEST_BILL,
      shares: [
        { ...TWO_GUEST_BILL.shares[0], status: "paid", paidAt: "2026-08-29T10:05:00.000Z" },
        TWO_GUEST_BILL.shares[1],
      ],
    };
    const fetchMock = routedFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(201, TWO_GUEST_BILL),
      "POST /qr/api/bills/b1/shares/g1/pay": () => jsonResponse(200, paidBill),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);
    await userEvent.click(await screen.findByTestId("checkout-pay-own"));
    expect(await screen.findByTestId("checkout-demo-badge")).toBeTruthy();

    await userEvent.click(screen.getByTestId("checkout-simulate-success"));

    expect(await screen.findByTestId("checkout-share-paid-g1")).toBeTruthy();
    expect(screen.queryByTestId("checkout-payment-sheet")).toBeNull();

    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/qr/api/bills/b1/shares/g1/pay") as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ simulatedOutcome: "success" });
  });

  it("a simulated failure leaves the share outstanding and shows a calm retry note, never an alert", async () => {
    const fetchMock = routedFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(201, TWO_GUEST_BILL),
      "POST /qr/api/bills/b1/shares/g1/pay": () => jsonResponse(200, TWO_GUEST_BILL), // unchanged: still outstanding
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);
    await userEvent.click(await screen.findByTestId("checkout-pay-own"));
    await userEvent.click(screen.getByTestId("checkout-simulate-failure"));

    expect(await screen.findByTestId("checkout-share-failed-g1")).toBeTruthy();
    expect(screen.queryByTestId("checkout-share-paid-g1")).toBeNull();
    expect(screen.getByTestId("checkout-pay-own")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("pay-all settles the whole bill in one simulated payment", async () => {
    const finalizedBill: GuestBillView = {
      ...TWO_GUEST_BILL,
      status: "finalized",
      billNumber: 7,
      finalizedAt: "2026-08-29T10:10:00.000Z",
      tenders: [{ id: "t1", method: "upi_manual", amountMinor: 52500, createdAt: "2026-08-29T10:10:00.000Z" }],
      shares: TWO_GUEST_BILL.shares.map((share) => ({ ...share, status: "paid", paidAt: "2026-08-29T10:10:00.000Z" })),
    };
    const fetchMock = routedFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(201, TWO_GUEST_BILL),
      "POST /qr/api/bills/b1/pay-all": () => jsonResponse(200, finalizedBill),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);
    await userEvent.click(await screen.findByTestId("checkout-mode-all"));
    await userEvent.click(await screen.findByTestId("checkout-pay-all"));
    await userEvent.click(screen.getByTestId("checkout-simulate-success"));

    expect(await screen.findByTestId("checkout-settled")).toBeTruthy();
    expect(screen.getByTestId("checkout-settled").textContent).toContain("₹525.00");
  });

  it("blocks pay-all with an explanation once any share is already paid individually", async () => {
    const partiallyPaidBill: GuestBillView = {
      ...TWO_GUEST_BILL,
      shares: [{ ...TWO_GUEST_BILL.shares[0], status: "paid", paidAt: "2026-08-29T10:05:00.000Z" }, TWO_GUEST_BILL.shares[1]],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, partiallyPaidBill)));

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);
    await userEvent.click(await screen.findByTestId("checkout-mode-all"));

    expect(await screen.findByTestId("checkout-payall-blocked")).toBeTruthy();
    expect(screen.queryByTestId("checkout-pay-all")).toBeNull();
  });

  it("routes a 410 to the settled/session-complete framing, not a dead screen or generic error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(410, { error: { code: "session_closed", message: "This table session has ended" } })));

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    const ended = await screen.findByTestId("qr-session-ended");
    expect(ended.textContent).toContain("Thanks for dining with us!");
  });

  it("formats the bill summary's money fields from minor units", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, TWO_GUEST_BILL)));
    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    await screen.findByTestId("checkout-bill-summary");
    const summary = screen.getByTestId("checkout-bill-summary");
    expect(summary.textContent).toContain("₹500.00"); // subtotal
    expect(summary.textContent).toContain("₹25.00"); // tax
    expect(screen.getByTestId("checkout-total").textContent).toBe("₹525.00");
  });

  it("shows an error state with retry when the initial load fails outright", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(jsonResponse(201, TWO_GUEST_BILL));
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);
    const retry = await screen.findByTestId("checkout-retry");
    await userEvent.click(retry);

    await waitFor(() => expect(screen.getByTestId("checkout-bill-summary")).toBeTruthy());
  });
});
