import { describe, expect, it, vi } from "vitest";
import type { GuestBillView } from "./checkout-api";
import { cardReturnUrl, isPaidFor, parseCardReturn, stripCardReturn, SYNC_RETRY_DELAYS_MS, syncUntilPaid, walletOptions } from "./card-payment-state";

function bill(myShare: "outstanding" | "paid", status: GuestBillView["status"] = "open"): GuestBillView {
  return {
    id: "b1",
    orderId: "o1",
    billNumber: null,
    subtotalMinor: 1000,
    taxMinor: 0,
    discountMinor: null,
    discountReason: null,
    totalMinor: 1000,
    status,
    createdAt: "2026-11-13T00:00:00.000Z",
    finalizedAt: null,
    tenders: [],
    shares: [
      { guestId: "g1", guestName: "A", amountMinor: 500, status: myShare, payerPhone: null, paidAt: null },
      { guestId: "g2", guestName: "B", amountMinor: 500, status: "outstanding", payerPhone: null, paidAt: null },
    ],
  };
}

describe("card-payment-state", () => {
  it("shows only the wallets ops allowed", () => {
    expect(walletOptions(["card"])).toEqual({ applePay: "never", googlePay: "never" });
    expect(walletOptions(["card", "apple_pay", "google_pay"])).toEqual({ applePay: "auto", googlePay: "auto" });
    expect(walletOptions(["card", "google_pay"])).toEqual({ applePay: "never", googlePay: "auto" });
  });

  it("round-trips the return URL and strips it afterwards", () => {
    const back = cardReturnUrl("https://x.test/qr/checkout?orderId=o1", "pi1");
    expect(back).toBe("https://x.test/qr/checkout?orderId=o1&card_intent=pi1");
    const stripe = `${back}&payment_intent=pi_abc&payment_intent_client_secret=pi_abc_secret&redirect_status=succeeded`;
    expect(parseCardReturn(new URL(stripe).search)).toEqual({ intentId: "pi1", reportedSuccess: true, reportedFailure: false });
    expect(parseCardReturn("?orderId=o1&card_intent=pi1&redirect_status=failed")).toEqual({ intentId: "pi1", reportedSuccess: false, reportedFailure: true });
    expect(parseCardReturn("?orderId=o1")).toBeNull();
    expect(stripCardReturn(stripe)).toBe("https://x.test/qr/checkout?orderId=o1");
  });

  it("counts my share or a finished bill as paid", () => {
    expect(isPaidFor(bill("outstanding"), "g1")).toBe(false);
    expect(isPaidFor(bill("paid"), "g1")).toBe(true);
    expect(isPaidFor(bill("outstanding", "finalized"), "g1")).toBe(true);
  });

  it("stops syncing once paid", async () => {
    const sync = vi.fn().mockResolvedValueOnce(bill("outstanding")).mockResolvedValueOnce(bill("paid"));
    const wait = vi.fn(() => Promise.resolve());
    const result = await syncUntilPaid(sync, "g1", wait);
    expect(result.paid).toBe(true);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(SYNC_RETRY_DELAYS_MS[0]);
  });

  it("gives up after the retries and says not paid", async () => {
    const sync = vi.fn(() => Promise.resolve(bill("outstanding")));
    const result = await syncUntilPaid(sync, "g1", () => Promise.resolve());
    expect(result.paid).toBe(false);
    expect(sync).toHaveBeenCalledTimes(SYNC_RETRY_DELAYS_MS.length + 1);
  });
});
