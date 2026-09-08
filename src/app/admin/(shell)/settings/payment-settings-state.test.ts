import { describe, expect, it } from "vitest";
import {
  isDirty,
  keyIdMode,
  providerOptionsFor,
  toDraft,
  toUpdatePayload,
  validateDraft,
  type PaymentSettingsDraft,
  type PaymentSettingsView,
} from "./payment-settings-state";

function view(overrides: Partial<PaymentSettingsView> = {}): PaymentSettingsView {
  return {
    provider: "simulated",
    mode: "test",
    keyId: null,
    hasKeySecret: false,
    hasWebhookSecret: false,
    webhookUrl: "https://api.restiqdev.idelta.com.au/webhooks/payments/razorpay/tenant-1",
    updatedAt: null,
    ...overrides,
  };
}

function razorpayDraft(overrides: Partial<PaymentSettingsDraft> = {}): PaymentSettingsDraft {
  return { provider: "razorpay", mode: "test", keyId: "rzp_test_Ab12Cd34Ef", keySecret: "s3cret", webhookSecret: "wh-s3cret", ...overrides };
}

describe("providerOptionsFor / toDraft", () => {
  it("offers Razorpay to Indian tenants only", () => {
    expect(providerOptionsFor("IN")).toEqual(["simulated", "razorpay"]);
    expect(providerOptionsFor("AU")).toEqual(["simulated"]);
  });

  it("starts the draft from the view with empty secret fields, never the stored values", () => {
    expect(toDraft(view({ provider: "razorpay", keyId: "rzp_test_Ab12Cd34Ef", hasKeySecret: true }))).toEqual({
      provider: "razorpay",
      mode: "test",
      keyId: "rzp_test_Ab12Cd34Ef",
      keySecret: "",
      webhookSecret: "",
    });
  });
});

describe("keyIdMode", () => {
  it("reads the mode from the Razorpay prefix", () => {
    expect(keyIdMode("rzp_test_Ab12Cd34Ef")).toBe("test");
    expect(keyIdMode(" rzp_live_Ab12Cd34Ef ")).toBe("live");
    expect(keyIdMode("rzp_test_")).toBeNull();
    expect(keyIdMode("sk_live_abc")).toBeNull();
  });
});

describe("validateDraft", () => {
  it("accepts a complete first-time Razorpay setup", () => {
    expect(validateDraft(razorpayDraft(), view())).toEqual({});
  });

  it("mirrors key_mode_mismatch: a test key cannot go live and a live key cannot stay in test", () => {
    expect(validateDraft(razorpayDraft({ mode: "live" }), view()).mode).toMatch(/test key cannot be used in live/);
    expect(validateDraft(razorpayDraft({ keyId: "rzp_live_Ab12Cd34Ef" }), view()).mode).toMatch(/live key cannot be used in test/);
  });

  it("rejects a missing or malformed key id", () => {
    expect(validateDraft(razorpayDraft({ keyId: "" }), view()).keyId).toMatch(/Enter the key id/);
    expect(validateDraft(razorpayDraft({ keyId: "abc" }), view()).keyId).toMatch(/exactly as Razorpay shows it/);
  });

  it("requires secrets only when none is stored or the provider changed (secrets are write-only)", () => {
    const stored = view({ provider: "razorpay", keyId: "rzp_test_Ab12Cd34Ef", hasKeySecret: true, hasWebhookSecret: true });
    expect(validateDraft(razorpayDraft({ keySecret: "", webhookSecret: "" }), stored)).toEqual({});
    const fresh = validateDraft(razorpayDraft({ keySecret: "", webhookSecret: "" }), view());
    expect(fresh.keySecret).toMatch(/key secret/);
    expect(fresh.webhookSecret).toMatch(/webhook secret/);
    const switched = validateDraft(razorpayDraft({ keySecret: "", webhookSecret: " " }), view({ provider: "simulated", hasKeySecret: true, hasWebhookSecret: true }));
    expect(switched.keySecret).toBeDefined();
    expect(switched.webhookSecret).toBeDefined();
  });

  it("lets the simulated provider skip keys but never go live", () => {
    expect(validateDraft({ provider: "simulated", mode: "test", keyId: "", keySecret: "", webhookSecret: "" }, view())).toEqual({});
    expect(validateDraft({ provider: "simulated", mode: "live", keyId: "", keySecret: "", webhookSecret: "" }, view()).mode).toMatch(/cannot go live/);
  });
});

describe("toUpdatePayload / isDirty", () => {
  it("sends only the secrets the owner typed, trimmed, and no keys for the simulated provider", () => {
    expect(toUpdatePayload(razorpayDraft({ keyId: " rzp_test_Ab12Cd34Ef ", keySecret: "", webhookSecret: " wh " }))).toEqual({
      provider: "razorpay",
      mode: "test",
      keyId: "rzp_test_Ab12Cd34Ef",
      webhookSecret: "wh",
    });
    expect(toUpdatePayload({ provider: "simulated", mode: "test", keyId: "stale", keySecret: "x", webhookSecret: "y" })).toEqual({ provider: "simulated", mode: "test" });
  });

  it("is dirty on any changed field or any typed secret, clean when the draft matches the view", () => {
    const stored = view({ provider: "razorpay", keyId: "rzp_test_Ab12Cd34Ef", hasKeySecret: true, hasWebhookSecret: true });
    expect(isDirty(toDraft(stored), stored)).toBe(false);
    expect(isDirty({ ...toDraft(stored), mode: "live" }, stored)).toBe(true);
    expect(isDirty({ ...toDraft(stored), keySecret: "rotated" }, stored)).toBe(true);
    expect(isDirty({ ...toDraft(stored), keyId: "rzp_test_Ab12Cd34Ef " }, stored)).toBe(false);
  });
});
