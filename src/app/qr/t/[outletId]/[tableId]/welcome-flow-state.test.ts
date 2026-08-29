import { describe, expect, it } from "vitest";
import { appendDigit, backspacePin, initialFlowState, isValidName, isValidPhone, PIN_LENGTH } from "./welcome-flow-state";

describe("welcome-flow-state", () => {
  it("starts in start-form when no session is open", () => {
    expect(initialFlowState(false)).toEqual({ step: "start-form", name: "", phone: "", error: null, pending: false });
  });

  it("starts in join-form when a session is already open", () => {
    expect(initialFlowState(true)).toEqual({ step: "join-form", name: "", pin: "", error: null, pending: false });
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

  it("isValidPhone requires exactly 10 digits", () => {
    expect(isValidPhone("987654321")).toBe(false);
    expect(isValidPhone("98765432100")).toBe(false);
    expect(isValidPhone("9876543210")).toBe(true);
  });
});
