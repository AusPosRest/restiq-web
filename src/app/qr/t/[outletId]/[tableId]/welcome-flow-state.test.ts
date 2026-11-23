import { describe, expect, it } from "vitest";
import { appendDigit, backspacePin, initialFlowState, isValidName, PIN_LENGTH } from "./welcome-flow-state";

describe("welcome-flow-state", () => {
  it("always starts in start-form - there is no per-table session-status lookup to pick a mode from", () => {
    expect(initialFlowState()).toEqual({ step: "start-form", name: "", error: null, notice: null, pending: false });
  });

  it("appendDigit stops at PIN_LENGTH", () => {
    expect(appendDigit("123", "4")).toBe("1234");
    expect(appendDigit("1234", "5")).toBe("1234");
    expect(PIN_LENGTH).toBe(4);
  });

  it("backspacePin removes the last digit", () => {
    expect(backspacePin("123")).toBe("12");
    expect(backspacePin("")).toBe("");
  });

  it("isValidName rejects blank/whitespace-only names", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName("   ")).toBe(false);
    expect(isValidName("Rahul")).toBe(true);
  });
});
