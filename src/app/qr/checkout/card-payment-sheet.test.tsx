import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuestBillView } from "./checkout-api";

// Stripe.js is a remote script - stand in for the Payment Element and confirmPayment.
const confirmPayment = vi.fn();
const loadStripe = vi.fn((key: string, options: { stripeAccount: string }) => Promise.resolve({ key, options }));
const paymentElementOptions = vi.fn();
vi.mock("@stripe/stripe-js", () => ({ loadStripe: (key: string, options: { stripeAccount: string }) => loadStripe(key, options) }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: ({ options }: { options: unknown }) => {
    paymentElementOptions(options);
    return <div data-testid="stripe-payment-element" />;
  },
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}));

const { CheckoutScreen } = await import("./checkout-screen");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const BILL: GuestBillView = {
  id: "b1",
  orderId: "o1",
  billNumber: null,
  subtotalMinor: 1000,
  taxMinor: 0,
  discountMinor: null,
  discountReason: null,
  totalMinor: 1000,
  status: "open",
  createdAt: "2026-11-13T00:00:00.000Z",
  finalizedAt: null,
  tenders: [],
  shares: [
    { guestId: "g1", guestName: "Ananya", amountMinor: 500, status: "outstanding", payerPhone: null, paidAt: null },
    { guestId: "g2", guestName: "Rohan", amountMinor: 500, status: "outstanding", payerPhone: null, paidAt: null },
  ],
  paymentsAvailable: true,
  cardPayments: { provider: "stripe", publishableKey: "pk_test_1", stripeAccountId: "acct_1", allowedMethods: ["card", "apple_pay"] },
};
const PAID_MINE: GuestBillView = { ...BILL, shares: [{ ...BILL.shares[0], status: "paid" }, BILL.shares[1]] };

function stubFetch(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${(init?.method ?? "GET").toUpperCase()} ${url}`;
    const handler = routes[key];
    return handler ? Promise.resolve(handler()) : Promise.reject(new Error(`Unhandled fetch: ${key}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("checkout card payments (#427)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    confirmPayment.mockReset();
    window.history.replaceState(null, "", "/qr/checkout?orderId=o1");
  });
  afterEach(cleanup);

  it("pays my share by card: starts the intent, confirms with Stripe, syncs, shows it paid", async () => {
    const fetchMock = stubFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(200, BILL),
      "POST /qr/api/bills/b1/card-payment": () => jsonResponse(200, { intentId: "int1", clientSecret: "pi_1_secret", amountMinor: 500, currency: "AUD" }),
      "POST /qr/api/card-payments/int1/sync": () => jsonResponse(200, PAID_MINE),
    });
    confirmPayment.mockResolvedValue({ paymentIntent: { status: "succeeded" } });
    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    await userEvent.click(await screen.findByTestId("checkout-pay-own"));
    expect(screen.queryByTestId("checkout-simulate-success")).toBeNull();
    await screen.findByTestId("stripe-payment-element");
    expect(loadStripe).toHaveBeenCalledWith("pk_test_1", { stripeAccount: "acct_1" });
    expect(paymentElementOptions).toHaveBeenLastCalledWith({ wallets: { applePay: "auto", googlePay: "never" } });
    const startCall = fetchMock.mock.calls.find(([url]) => url === "/qr/api/bills/b1/card-payment");
    expect(JSON.parse(String(startCall?.[1]?.body))).toEqual({ guestId: "g1" });

    await userEvent.click(screen.getByTestId("checkout-card-pay"));
    await screen.findByTestId("checkout-share-paid-g1");
    expect(confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ redirect: "if_required", confirmParams: { return_url: "http://localhost:3000/qr/checkout?orderId=o1&card_intent=int1" } }),
    );
    expect(screen.queryByTestId("checkout-card-sheet")).toBeNull();
  });

  it("shows Stripe's message inline when the card is declined, and lets the guest close the sheet", async () => {
    stubFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(200, BILL),
      "POST /qr/api/bills/b1/card-payment": () => jsonResponse(200, { intentId: "int1", clientSecret: "pi_1_secret", amountMinor: 1000, currency: "AUD" }),
    });
    confirmPayment.mockResolvedValue({ error: { message: "Your card was declined." } });
    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    await userEvent.click(await screen.findByTestId("checkout-mode-all"));
    await userEvent.click(screen.getByTestId("checkout-pay-all"));
    await userEvent.click(await screen.findByTestId("checkout-card-pay"));
    expect((await screen.findByTestId("checkout-card-error")).textContent).toBe("Your card was declined.");
    await userEvent.click(screen.getByTestId("checkout-card-cancel"));
    expect(screen.queryByTestId("checkout-card-sheet")).toBeNull();
  });

  it("syncs once on return from a Stripe redirect and strips the params from the URL", async () => {
    window.history.replaceState(null, "", "/qr/checkout?orderId=o1&card_intent=int1&payment_intent=pi_1&payment_intent_client_secret=s&redirect_status=succeeded");
    const fetchMock = stubFetch({
      "POST /qr/api/orders/o1/bill": () => jsonResponse(200, BILL),
      "POST /qr/api/card-payments/int1/sync": () => jsonResponse(200, PAID_MINE),
    });
    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);

    await screen.findByTestId("checkout-share-paid-g1");
    expect(window.location.search).toBe("?orderId=o1");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/qr/api/card-payments/int1/sync")).toHaveLength(1);
  });

  it("keeps the simulated sheet when the bill has no cardPayments", async () => {
    stubFetch({ "POST /qr/api/orders/o1/bill": () => jsonResponse(200, { ...BILL, cardPayments: null }) });
    render(<CheckoutScreen orderId="o1" myGuestId="g1" />);
    await userEvent.click(await screen.findByTestId("checkout-pay-own"));
    await waitFor(() => expect(screen.getByTestId("checkout-simulate-success")).toBeTruthy());
    expect(screen.queryByTestId("checkout-card-sheet")).toBeNull();
  });
});
