import { describe, expect, it } from "vitest";
import { appendDigit, backspacePin, PIN_LENGTH, secondsRemaining } from "./pin-login-state";

describe("appendDigit", () => {
  it("appends digits up to the PIN length", () => {
    let pin = "";
    for (const digit of ["1", "2", "3", "4"]) pin = appendDigit(pin, digit);
    expect(pin).toBe("1234");
    expect(pin.length).toBe(PIN_LENGTH);
  });

  it("ignores further digits once the PIN is full", () => {
    expect(appendDigit("1234", "5")).toBe("1234");
  });
});

describe("backspacePin", () => {
  it("removes the last digit", () => {
    expect(backspacePin("123")).toBe("12");
  });

  it("is a no-op on an empty PIN", () => {
    expect(backspacePin("")).toBe("");
  });
});

describe("secondsRemaining", () => {
  it("computes whole seconds remaining, ceiling partial seconds", () => {
    const now = Date.parse("2026-08-25T12:00:00.000Z");
    expect(secondsRemaining("2026-08-25T12:00:30.000Z", now)).toBe(30);
    expect(secondsRemaining("2026-08-25T12:00:00.500Z", now)).toBe(1);
  });

  it("floors at 0 once the lockout has passed", () => {
    const now = Date.parse("2026-08-25T12:00:31.000Z");
    expect(secondsRemaining("2026-08-25T12:00:30.000Z", now)).toBe(0);
  });
});
