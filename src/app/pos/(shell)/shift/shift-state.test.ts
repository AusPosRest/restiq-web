import { describe, expect, it } from "vitest";
import {
  appendDigit,
  appendEntryKey,
  digitsToMinor,
  entryToMinor,
  formatMinor,
  validateCountedCash,
  validateMovementForm,
  validateOpeningFloat,
} from "./shift-state";

describe("formatMinor", () => {
  it("renders rupees with paise, not rounded to whole rupees", () => {
    expect(formatMinor(184550)).toBe("₹1,845.50");
    expect(formatMinor(0)).toBe("₹0.00");
  });

  it("shows Australian dollars as A$ (PE-10), and falls back to the code for an unmapped currency", () => {
    expect(formatMinor(500, "AUD")).toBe("A$5.00");
    expect(formatMinor(500, "NZD")).toBe("NZD 5.00");
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

// restiq-web#370: the shift keypads read digits as whole rupees / dollars, with a decimal point for cents.
describe("appendEntryKey / entryToMinor", () => {
  const type = (keys: string) => [...keys].reduce((entry, key) => appendEntryKey(entry, key), "");

  it("reads plain digits as whole currency units", () => {
    expect(entryToMinor(type("1000"))).toBe(100000);
    expect(entryToMinor(type("20000"))).toBe(2000000);
    expect(entryToMinor("")).toBe(0);
  });

  it("takes cents after a decimal point, at most two", () => {
    expect(entryToMinor(type("523.45"))).toBe(52345);
    expect(entryToMinor(type("523.4"))).toBe(52340);
    expect(entryToMinor(type("523."))).toBe(52300);
    expect(entryToMinor(type(".05"))).toBe(5);
    expect(type("1.239")).toBe("1.23");
  });

  it("keeps one decimal point, drops leading zeros and caps the whole part", () => {
    expect(type("1..5")).toBe("1.5");
    expect(type(".")).toBe("0.");
    expect(type("007")).toBe("7");
    expect(type("12345678")).toBe("1234567");
    expect(type("1234567.89")).toBe("1234567.89");
  });

  it("a movement of zero is still refused", () => {
    expect(validateMovementForm(type("0.00"), "Float top-up").amount).toBeTruthy();
    expect(validateMovementForm(type("0.50"), "Float top-up").amount).toBeUndefined();
  });
});
