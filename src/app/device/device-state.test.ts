import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredDevice,
  continueTargetFor,
  formatCodeInput,
  getOrCreateFingerprint,
  humanizeStatus,
  humanizeType,
  isCodeComplete,
  readStoredDevice,
  writeStoredDevice,
  type DeviceView,
} from "./device-state";

const DEVICE: DeviceView = {
  id: "d1",
  tenantId: "t1",
  outletId: "o1",
  label: "Front Counter 1",
  type: "pos",
  role: "terminal",
  status: "active",
  enrolledAt: "2026-09-02T10:00:00.000Z",
  revokedAt: null,
};

describe("formatCodeInput", () => {
  it("uppercases and inserts the XXX-XXX dash", () => {
    expect(formatCodeInput("abc234")).toBe("ABC-234");
  });

  it("strips characters outside the code alphabet, including I/O/0/1", () => {
    expect(formatCodeInput("aI0O1bc234")).toBe("ABC-234");
  });

  it("truncates past six characters", () => {
    expect(formatCodeInput("abcdefghij")).toBe("ABC-DEF");
  });

  it("leaves a partial code with no dash", () => {
    expect(formatCodeInput("ab")).toBe("AB");
  });
});

describe("isCodeComplete", () => {
  it("accepts a full XXX-XXX code from the alphabet", () => {
    expect(isCodeComplete("ABC-234")).toBe(true);
  });

  it("rejects a partial code", () => {
    expect(isCodeComplete("ABC-2")).toBe(false);
  });

  it("rejects excluded characters even if the shape matches", () => {
    expect(isCodeComplete("AB0-234")).toBe(false);
  });
});

describe("localStorage-backed helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a fingerprint once and reuses it on re-enrol", () => {
    const first = getOrCreateFingerprint();
    expect(first).toMatch(/^web-/);
    const second = getOrCreateFingerprint();
    expect(second).toBe(first);
  });

  it("falls back to a fresh fingerprint when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(getOrCreateFingerprint()).toMatch(/^web-/);
  });

  it("round-trips a stored device through write/read/clear", () => {
    expect(readStoredDevice()).toBeNull();
    writeStoredDevice(DEVICE);
    expect(readStoredDevice()).toEqual(DEVICE);
    clearStoredDevice();
    expect(readStoredDevice()).toBeNull();
  });

  it("returns null for malformed stored JSON instead of throwing", () => {
    window.localStorage.setItem("device:enrolled", "{not json");
    expect(readStoredDevice()).toBeNull();
  });
});

describe("continueTargetFor", () => {
  it("routes pos to the POS login", () => {
    expect(continueTargetFor("pos")).toEqual({ kind: "redirect", path: "/pos/login" });
  });

  it("routes kds to the KDS entry", () => {
    expect(continueTargetFor("kds")).toEqual({ kind: "redirect", path: "/kds" });
  });

  it("has no web surface for kiosk or cds", () => {
    expect(continueTargetFor("kiosk")).toEqual({ kind: "unsupported" });
    expect(continueTargetFor("cds")).toEqual({ kind: "unsupported" });
  });
});

describe("humanize helpers", () => {
  it("labels every device type", () => {
    expect(humanizeType("pos")).toBe("POS terminal");
    expect(humanizeType("kds")).toBe("Kitchen display");
    expect(humanizeType("kiosk")).toBe("Kiosk");
    expect(humanizeType("cds")).toBe("Customer display");
  });

  it("warms up the raw status", () => {
    expect(humanizeStatus("active")).toBe("Enrolled");
    expect(humanizeStatus("revoked")).toBe("Revoked");
  });
});
