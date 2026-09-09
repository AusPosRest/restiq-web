import { describe, expect, it } from "vitest";
import {
  canRetryIntent,
  formatCountdown,
  INTENT_POLL_FAST_MS,
  INTENT_POLL_SLOW_MS,
  intentExpiresInMs,
  isActiveIntent,
  isAwaitingServerExpiry,
  isTerminalIntentStatus,
  mergeIntentPoll,
  nextIntentPollMs,
  type PaymentIntentStatus,
  type PaymentIntentView,
} from "./payment-intent";

function intent(overrides: Partial<PaymentIntentView> = {}): PaymentIntentView {
  return {
    id: "pi-1",
    billId: "bill-1",
    shareGuestId: null,
    rail: "upi_qr",
    provider: "razorpay",
    amountMinor: 52500,
    currency: "INR",
    status: "pending",
    failureReason: null,
    providerRef: "qr_ABC",
    client: { qrImageUrl: "https://rzp.io/qr/abc.png" },
    createdAt: "2026-09-09T06:00:00.000Z",
    expiresAt: "2026-09-09T06:05:00.000Z",
    succeededAt: null,
    tenderId: null,
    ...overrides,
  };
}

describe("status machine", () => {
  it.each<[PaymentIntentStatus, boolean]>([
    ["created", false],
    ["pending", false],
    ["succeeded", true],
    ["failed", true],
    ["expired", true],
    ["cancelled", true],
  ])("%s terminal = %s", (status, terminal) => {
    expect(isTerminalIntentStatus(status)).toBe(terminal);
  });

  it("treats null and terminal intents as not active", () => {
    expect(isActiveIntent(null)).toBe(false);
    expect(isActiveIntent(intent({ status: "succeeded" }))).toBe(false);
    expect(isActiveIntent(intent({ status: "pending" }))).toBe(true);
  });

  it("allows a retry only after a failed, expired or cancelled intent - never after a paid one", () => {
    expect(canRetryIntent(intent({ status: "failed" }))).toBe(true);
    expect(canRetryIntent(intent({ status: "expired" }))).toBe(true);
    expect(canRetryIntent(intent({ status: "cancelled" }))).toBe(true);
    expect(canRetryIntent(intent({ status: "succeeded" }))).toBe(false);
    expect(canRetryIntent(intent({ status: "pending" }))).toBe(false);
  });
});

describe("mergeIntentPoll", () => {
  it("takes the incoming view when there is no current one or the id changed (a retry made a new intent)", () => {
    const fresh = intent({ id: "pi-2", status: "pending" });
    expect(mergeIntentPoll(null, fresh)).toBe(fresh);
    expect(mergeIntentPoll(intent({ status: "succeeded" }), fresh)).toBe(fresh);
  });

  it("never regresses a terminal status to pending on a stale poll", () => {
    const paid = intent({ status: "succeeded", tenderId: "tender-1" });
    expect(mergeIntentPoll(paid, intent({ status: "pending" }))).toBe(paid);
    const expired = intent({ status: "expired" });
    expect(mergeIntentPoll(expired, intent({ status: "created" }))).toBe(expired);
  });

  it("lets a late capture move expired to succeeded (ADR-011) but never the reverse", () => {
    const paid = intent({ status: "succeeded", tenderId: "tender-1" });
    expect(mergeIntentPoll(intent({ status: "expired" }), paid)).toBe(paid);
    expect(mergeIntentPoll(paid, intent({ status: "expired" }))).toBe(paid);
  });

  it("prefers the incoming view on an equal rank so provider refs and reasons refresh", () => {
    const current = intent({ status: "pending", providerRef: null });
    const incoming = intent({ status: "pending", providerRef: "qr_ABC" });
    expect(mergeIntentPoll(current, incoming)).toBe(incoming);
  });
});

describe("poll cadence and countdown", () => {
  it("polls fast for the first 30 s, then at the surface's 5 s", () => {
    expect(nextIntentPollMs(0)).toBe(INTENT_POLL_FAST_MS);
    expect(nextIntentPollMs(29_999)).toBe(INTENT_POLL_FAST_MS);
    expect(nextIntentPollMs(30_000)).toBe(INTENT_POLL_SLOW_MS);
  });

  it("counts down to zero and never below", () => {
    const now = Date.parse("2026-09-09T06:04:30.000Z");
    expect(intentExpiresInMs(intent(), now)).toBe(30_000);
    expect(intentExpiresInMs(intent(), now + 60_000)).toBe(0);
  });

  it("flags a pending intent whose clock ran out as awaiting the server, not retryable", () => {
    const late = Date.parse("2026-09-09T06:06:00.000Z");
    expect(isAwaitingServerExpiry(intent(), late)).toBe(true);
    expect(isAwaitingServerExpiry(intent({ status: "expired" }), late)).toBe(false);
    expect(isAwaitingServerExpiry(intent(), late - 120_000)).toBe(false);
  });

  it("formats m:ss", () => {
    expect(formatCountdown(299_000)).toBe("4:59");
    expect(formatCountdown(5_400)).toBe("0:05");
    expect(formatCountdown(-1)).toBe("0:00");
  });
});
