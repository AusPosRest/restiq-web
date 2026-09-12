import { afterEach, describe, expect, it } from "vitest";
import { clearTerminalBinding, getTabDeviceId, getTerminalBinding, saveTabDeviceId, saveTerminalBinding } from "./terminal-binding";

const KEY = "pos:terminal-binding";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("tab device id", () => {
  it("is null with neither a tab id nor a shared binding", () => {
    expect(getTabDeviceId()).toBeNull();
  });

  it("falls back to the shared binding's device", () => {
    saveTerminalBinding({ tenantId: "t1", deviceId: "shared-device" });
    expect(getTabDeviceId()).toBe("shared-device");
  });

  it("prefers this tab's own device over the shared binding another tab overwrote", () => {
    saveTabDeviceId("pos-device");
    saveTerminalBinding({ tenantId: "t1", deviceId: "printer-device" });
    expect(getTabDeviceId()).toBe("pos-device");
  });
});

describe("terminal-binding", () => {
  it("returns null when nothing is saved", () => {
    expect(getTerminalBinding()).toBeNull();
  });

  it("round-trips a saved binding, including an optional tenantName", () => {
    saveTerminalBinding({ tenantId: "t1", deviceId: "d1", tenantName: "Spice Route" });
    expect(getTerminalBinding()).toEqual({ tenantId: "t1", deviceId: "d1", tenantName: "Spice Route" });
  });

  it("omits tenantName from the result when it was never saved", () => {
    saveTerminalBinding({ tenantId: "t1", deviceId: "d1" });
    expect(getTerminalBinding()).toEqual({ tenantId: "t1", deviceId: "d1" });
  });

  it("clears a saved binding", () => {
    saveTerminalBinding({ tenantId: "t1", deviceId: "d1" });
    clearTerminalBinding();
    expect(getTerminalBinding()).toBeNull();
  });

  it("treats malformed stored JSON as no binding", () => {
    window.localStorage.setItem(KEY, "not json");
    expect(getTerminalBinding()).toBeNull();
  });

  it("treats a stored value missing tenantId/deviceId as no binding", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ tenantName: "Spice Route" }));
    expect(getTerminalBinding()).toBeNull();
  });
});
