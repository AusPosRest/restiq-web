import { describe, expect, it } from "vitest";
import { capabilityDescription, capabilityLabel, KNOWN_CAPABILITY_KEYS, mergeCapabilities } from "./capability-state";

describe("capabilityLabel", () => {
  it("returns a friendly label for known capability keys", () => {
    expect(capabilityLabel("qr_ordering")).toBe("QR Ordering");
    expect(capabilityLabel("kiosk")).toBe("Kiosk Mode");
    expect(capabilityLabel("token_queue")).toBe("Token Queue");
  });

  it("title-cases an unrecognised key instead of dropping it", () => {
    expect(capabilityLabel("self_checkout")).toBe("Self Checkout");
  });
});

describe("capabilityDescription", () => {
  it("returns a description for known keys", () => {
    expect(capabilityDescription("qr_ordering")).toMatch(/table QR code/);
  });

  it("returns null for an unrecognised key", () => {
    expect(capabilityDescription("self_checkout")).toBeNull();
  });
});

describe("mergeCapabilities", () => {
  it("renders every known key, defaulting an absent one to disabled (backend: absent row = not yet toggled)", () => {
    const result = mergeCapabilities(KNOWN_CAPABILITY_KEYS, [{ key: "qr_ordering", enabled: true }]);
    expect(result).toEqual([
      { key: "qr_ordering", enabled: true },
      { key: "kiosk", enabled: false },
      { key: "token_queue", enabled: false },
    ]);
  });

  it("renders every known key as disabled for a fresh outlet with zero rows", () => {
    expect(mergeCapabilities(KNOWN_CAPABILITY_KEYS, [])).toEqual([
      { key: "qr_ordering", enabled: false },
      { key: "kiosk", enabled: false },
      { key: "token_queue", enabled: false },
    ]);
  });

  it("still surfaces an unrecognised key the backend returns, appended after the known set", () => {
    const result = mergeCapabilities(KNOWN_CAPABILITY_KEYS, [{ key: "self_checkout", enabled: true }]);
    expect(result).toEqual([
      { key: "qr_ordering", enabled: false },
      { key: "kiosk", enabled: false },
      { key: "token_queue", enabled: false },
      { key: "self_checkout", enabled: true },
    ]);
  });
});
