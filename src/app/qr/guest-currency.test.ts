import { describe, expect, it } from "vitest";
import { menuCurrency } from "./guest-currency";

const item = (currency: string | null, variants: Array<{ currency: string | null }> = []) => ({ currency, variants });

describe("menuCurrency (issue #403)", () => {
  it("reads the tenant's currency off the first priced item", () => {
    expect(menuCurrency({ categories: [{ items: [item(null), item("AUD")] }] })).toBe("AUD");
  });

  it("falls back to a variant's or a combo's currency", () => {
    expect(menuCurrency({ categories: [{ items: [item(null, [{ currency: "AUD" }])] }] })).toBe("AUD");
    expect(menuCurrency({ categories: [], combos: [{ currency: "INR" }] })).toBe("INR");
  });

  it("is null for an unpriced menu or a body that isn't a menu", () => {
    expect(menuCurrency({ categories: [{ items: [item(null)] }] })).toBeNull();
    expect(menuCurrency({ id: "b1" })).toBeNull();
    expect(menuCurrency(null)).toBeNull();
  });
});
