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

  it("rounds rupee cash to the nearest rupee and leaves other currencies alone (CU-11)", () => {
    expect(cashRoundOffMinor(89040, "INR")).toBe(-40);
    expect(cashRoundOffMinor(89060, "INR")).toBe(40);
    expect(cashRoundOffMinor(89050, "INR")).toBe(50);
    expect(cashRoundOffMinor(89000, "INR")).toBe(0);
    expect(cashRoundOffMinor(1995, "AUD")).toBe(0);
  });
});
