import { afterEach, describe, expect, it } from "vitest";
import { clearTerminalBinding, getTerminalBinding, saveTerminalBinding } from "./terminal-binding";

const KEY = "pos:terminal-binding";

afterEach(() => {
  window.localStorage.clear();
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
