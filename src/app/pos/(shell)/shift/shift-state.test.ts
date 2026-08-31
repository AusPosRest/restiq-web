import { describe, expect, it } from "vitest";
import {
  appendDigit,
  digitsToMinor,
  formatMinor,
  validateCountedCash,
  validateMovementForm,
  validateOpeningFloat,
} from "./shift-state";

describe("formatMinor", () => {
  it("renders rupees with paise, not rounded to whole rupees", () => {
    expect(formatMinor(184550)).toBe("₹1845.50");
    expect(formatMinor(0)).toBe("₹0.00");
  });

  it("falls back to the currency code for an unmapped currency", () => {
    expect(formatMinor(500, "AUD")).toBe("AUD 5.00");
  });
});

describe("appendDigit / digitsToMinor", () => {
  it("builds up a calculator-style digit string and drops leading zeros", () => {
    let digits = "";
    digits = appendDigit(digits, "1");
    digits = appendDigit(digits, "8");
    digits = appendDigit(digits, "0");
    expect(digits).toBe("180");
    expect(digitsToMinor(digits)).toBe(180);
  });

  it("treats an empty digit string as zero", () => {
    expect(digitsToMinor("")).toBe(0);
  });

  it("caps the digit string at maxDigits", () => {
    const digits = "123456789";
    expect(appendDigit(digits, "9", 9)).toBe(digits);
  });
});

describe("validateOpeningFloat", () => {
  it("requires a float to be entered before opening", () => {
    expect(validateOpeningFloat("")).toMatch(/enter/i);
    expect(validateOpeningFloat("0")).toBeNull();
    expect(validateOpeningFloat("5000")).toBeNull();
  });
});

describe("validateMovementForm", () => {
  it("requires a positive amount and a non-blank reason", () => {
    expect(validateMovementForm("", "")).toEqual({
      amount: "Enter an amount greater than zero.",
      reason: "Enter a reason to continue.",
    });
    expect(validateMovementForm("0", "Bank drop")).toEqual({ amount: "Enter an amount greater than zero." });
    expect(validateMovementForm("500", "   ")).toEqual({ reason: "Enter a reason to continue." });
    expect(validateMovementForm("500", "Petty cash for supplies")).toEqual({});
  });
});

describe("validateCountedCash", () => {
  it("requires the drawer to be counted before submitting", () => {
    expect(validateCountedCash("")).toMatch(/count the cash/i);
    expect(validateCountedCash("0")).toBeNull();
  });
});
