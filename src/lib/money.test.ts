import { describe, expect, it } from "vitest";
import { cashRoundOffMinor, formatMoney, formatPrice, localeForCurrency } from "./money";

describe("money (PE-10, PE-23)", () => {
  it("shows rupees with Indian grouping and paise", () => {
    expect(formatMoney(136395, "INR")).toBe("₹1,363.95");
    expect(formatMoney(12345678, "INR")).toBe("₹1,23,456.78");
    expect(formatMoney(-1050, "INR")).toBe("-₹10.50");
  });

  it("shows Australian dollars as A$, never rupees", () => {
    expect(formatMoney(1990, "AUD")).toBe("A$19.90");
    expect(formatMoney(12345678, "AUD")).toBe("A$123,456.78");
  });

  it("keeps menu prices whole when they are whole, and never rounds paise away", () => {
    expect(formatPrice(34000, "INR")).toBe("₹340");
    expect(formatPrice(19950, "INR")).toBe("₹199.50");
    expect(formatPrice(1600, "AUD")).toBe("A$16");
  });

  it("picks the market locale", () => {
    expect(localeForCurrency("AUD")).toBe("en-AU");
    expect(localeForCurrency("INR")).toBe("en-IN");
  });

  it("rounds rupee cash to the nearest rupee and Australian cash to 5 cents, half up (CU-11, restiq-web#377)", () => {
    expect(cashRoundOffMinor(89040, "INR")).toBe(-40);
    expect(cashRoundOffMinor(89060, "INR")).toBe(40);
    expect(cashRoundOffMinor(89050, "INR")).toBe(50);
    expect(cashRoundOffMinor(89000, "INR")).toBe(0);
    expect(cashRoundOffMinor(1995, "AUD")).toBe(0);
    expect(cashRoundOffMinor(1233, "AUD")).toBe(2);
    expect(cashRoundOffMinor(1232, "AUD")).toBe(-2);
    expect(cashRoundOffMinor(1231, "AUD")).toBe(-1);
    expect(cashRoundOffMinor(1234, "AUD")).toBe(1);
    expect(cashRoundOffMinor(1995, "USD")).toBe(0);
    expect(cashRoundOffMinor(0, "INR")).toBe(0);
    expect(cashRoundOffMinor(-40, "INR")).toBe(0);
  });

  it("agrees with restiq-backend's integer rule for every due amount", () => {
    for (const [currency, unit] of [["INR", 100], ["AUD", 5]] as const) {
      for (let due = 1; due <= 2000; due++) {
        expect(due + cashRoundOffMinor(due, currency)).toBe(Math.floor((due * 2 + unit) / (2 * unit)) * unit);
      }
    }
  });
});
