import { describe, expect, it } from "vitest";
import type { PaymentIntentView } from "@/lib/payment-intent";
import { guestPayOptions, intentHandoff, isDemoProvider, sharePayPhase, toAppUpiUrl, UPI_APPS } from "./payment-rail-state";

const UPI_URL = "upi://pay?pa=merchant@bank&pn=Restiq%20Demo&am=525.00&tr=pi-1&cu=INR";

function intent(overrides: Partial<PaymentIntentView> = {}): PaymentIntentView {
  return {
    id: "pi-1",
    billId: "bill-1",
    shareGuestId: "guest-1",
    rail: "upi_intent",
    provider: "razorpay",
    amountMinor: 52500,
    currency: "INR",
    status: "pending",
    failureReason: null,
    providerRef: "order_1",
    client: { checkout: { keyId: "rzp_test_abc", orderId: "order_1", upiFirst: true } },
    createdAt: "2026-09-09T06:00:00.000Z",
    expiresAt: "2026-09-09T06:05:00.000Z",
    succeededAt: null,
    tenderId: null,
    ...overrides,
  };
}

describe("guestPayOptions", () => {
  it("offers UPI apps first, card when the provider supports it, and pay-at-counter last", () => {
    const options = guestPayOptions({ onlinePayments: true, provider: "razorpay", cardOnline: true });
    expect(options.slice(0, UPI_APPS.length).map((o) => (o.kind === "upi" ? o.app : o.kind))).toEqual(["gpay", "phonepe", "paytm", "other"]);
    expect(options.at(-2)).toEqual({ kind: "card" });
    expect(options.at(-1)).toEqual({ kind: "counter" });
  });

  it("drops card when the provider does not offer it", () => {
    const options = guestPayOptions({ onlinePayments: true, provider: "simulated", cardOnline: false });
    expect(options.some((o) => o.kind === "card")).toBe(false);
    expect(options.at(-1)).toEqual({ kind: "counter" });
  });

  it("offers only pay-at-counter when the outlet has online payments off (ADR-007)", () => {
    expect(guestPayOptions({ onlinePayments: false, provider: "razorpay", cardOnline: true })).toEqual([{ kind: "counter" }]);
  });
});

describe("toAppUpiUrl", () => {
  it("swaps only the scheme and path for a known app, keeping the provider's query intact", () => {
    expect(toAppUpiUrl(UPI_URL, "gpay")).toBe(`tez://upi/pay?pa=merchant@bank&pn=Restiq%20Demo&am=525.00&tr=pi-1&cu=INR`);
    expect(toAppUpiUrl(UPI_URL, "phonepe").startsWith("phonepe://pay?pa=")).toBe(true);
    expect(toAppUpiUrl(UPI_URL, "paytm").startsWith("paytmmp://pay?pa=")).toBe(true);
  });

  it("leaves the generic URL alone for the OS chooser and for anything that is not a upi://pay link", () => {
    expect(toAppUpiUrl(UPI_URL, "other")).toBe(UPI_URL);
    expect(toAppUpiUrl("https://rzp.io/i/abc", "gpay")).toBe("https://rzp.io/i/abc");
    expect(toAppUpiUrl("upi://pay", "gpay")).toBe("upi://pay");
  });
});

describe("sharePayPhase", () => {
  it("lets the server's paid status win over anything the intent says", () => {
    expect(sharePayPhase({ status: "paid" }, null)).toBe("paid");
    expect(sharePayPhase({ status: "paid" }, intent({ status: "failed" }))).toBe("paid");
  });

  it("walks idle → awaiting → paid, and offers a retry only after a terminal non-success", () => {
    expect(sharePayPhase({ status: "outstanding" }, null)).toBe("idle");
    expect(sharePayPhase({ status: "outstanding" }, intent({ status: "pending" }))).toBe("awaiting");
    expect(sharePayPhase({ status: "outstanding" }, intent({ status: "succeeded" }))).toBe("paid");
    expect(sharePayPhase({ status: "outstanding" }, intent({ status: "expired" }))).toBe("retry");
    expect(sharePayPhase({ status: "outstanding" }, intent({ status: "failed" }))).toBe("retry");
  });
});

describe("intentHandoff", () => {
  it("prefers the demo controls, then a direct UPI link (app-specific when an app was picked), then hosted checkout", () => {
    expect(intentHandoff(intent({ client: { simulated: true } }), "gpay")).toEqual({ kind: "simulated" });
    expect(intentHandoff(intent({ client: { upiIntentUrl: UPI_URL } }), "gpay")).toEqual({ kind: "upi_url", url: toAppUpiUrl(UPI_URL, "gpay") });
    expect(intentHandoff(intent({ client: { upiIntentUrl: UPI_URL } }), null)).toEqual({ kind: "upi_url", url: UPI_URL });
    expect(intentHandoff(intent(), "phonepe")).toEqual({ kind: "checkout", keyId: "rzp_test_abc", orderId: "order_1", upiFirst: true });
    expect(intentHandoff(intent({ client: {} }), null)).toEqual({ kind: "none" });
  });

  it("marks only the simulated provider as demo", () => {
    expect(isDemoProvider("simulated")).toBe(true);
    expect(isDemoProvider("razorpay")).toBe(false);
  });
});
