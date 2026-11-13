import { describe, expect, it } from "vitest";
import type { PaymentIntentView } from "@/lib/payment-intent";
import type { CardReaderView } from "../../../api";
import { canSendToReader, defaultReaderId, readerFailureText, readerWaitingText, showSimulateControls } from "./card-reader-state";

function reader(id: string, status: CardReaderView["status"] = "online"): CardReaderView {
  return { id, outletId: "outlet-1", outletName: "Main", label: `Reader ${id}`, deviceType: "stripe_s700", serialNumber: `SN-${id}`, status, simulated: false };
}

const intent: PaymentIntentView = {
  id: "pi-1",
  billId: "bill-1",
  shareGuestId: null,
  rail: "card_terminal",
  provider: "stripe",
  amountMinor: 5000,
  currency: "AUD",
  status: "pending",
  failureReason: null,
  providerRef: null,
  client: {},
  createdAt: "2026-11-13T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  succeededAt: null,
  tenderId: null,
  readerId: "a",
  readerLabel: "Front counter",
};

describe("defaultReaderId", () => {
  it("auto-picks the only reader", () => {
    expect(defaultReaderId([reader("a")], null)).toBe("a");
  });

  it("prefers the reader this device used last", () => {
    expect(defaultReaderId([reader("a"), reader("b")], "b")).toBe("b");
  });

  it("skips a remembered reader that is offline or gone, and offline readers generally", () => {
    expect(defaultReaderId([reader("a", "offline"), reader("b", "offline"), reader("c")], "a")).toBe("c");
    expect(defaultReaderId([reader("a"), reader("b")], "gone")).toBe("a");
  });

  it("treats unknown status as available, and picks nothing when every reader is offline", () => {
    expect(defaultReaderId([reader("a", "unknown")], null)).toBe("a");
    expect(defaultReaderId([reader("a", "offline")], null)).toBeNull();
    expect(defaultReaderId([], "a")).toBeNull();
  });
});

describe("canSendToReader", () => {
  it("needs a chosen reader that is not offline", () => {
    expect(canSendToReader([reader("a")], "a")).toBe(true);
    expect(canSendToReader([reader("a", "offline")], "a")).toBe(false);
    expect(canSendToReader([reader("a")], null)).toBe(false);
  });
});

describe("reader panel text", () => {
  it("names the reader in the waiting prompt", () => {
    expect(readerWaitingText("Front counter")).toBe("Tap, insert or swipe on Front counter");
    expect(readerWaitingText(null)).toBe("Tap, insert or swipe on the card reader");
  });

  it("shows Stripe's reason only for a failed Stripe intent", () => {
    expect(readerFailureText({ ...intent, status: "failed", failureReason: "Your card has insufficient funds." })).toBe("Your card has insufficient funds.");
    expect(readerFailureText({ ...intent, status: "failed", failureReason: null })).toBe("The card reader couldn't take this payment.");
    expect(readerFailureText({ ...intent, status: "cancelled" })).toBeNull();
    expect(readerFailureText({ ...intent, provider: "simulated", status: "failed", failureReason: "declined" })).toBeNull();
  });
});

describe("showSimulateControls", () => {
  it("shows for a waiting Stripe intent until the server says it isn't a sandbox", () => {
    expect(showSimulateControls(intent, true)).toBe(true);
    expect(showSimulateControls(intent, false)).toBe(false);
    expect(showSimulateControls({ ...intent, status: "succeeded" }, true)).toBe(false);
    expect(showSimulateControls({ ...intent, provider: "simulated" }, true)).toBe(false);
  });
});
