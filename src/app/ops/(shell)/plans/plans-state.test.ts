import { describe, expect, it } from "vitest";
import type { PlanPriceView } from "../api";
import type { ReaderPriceView } from "@/lib/card-readers";
import { formFromPrice, isDirty, readerPriceForm, validatePlanPriceForm, validateReaderPrice } from "./plans-state";

const ROW: PlanPriceView = { country: "IN", plan: "standard", monthlyPriceMinor: 49900, annualDiscountPercent: 20, currency: "INR", updatedAt: "" };

describe("plans-state", () => {
  it("shows minor units as typed major units, blank for on quote", () => {
    expect(formFromPrice(ROW)).toEqual({ price: "499", discount: "20" });
    expect(formFromPrice({ ...ROW, monthlyPriceMinor: null }).price).toBe("");
  });

  it("validates price and discount", () => {
    expect(validatePlanPriceForm({ price: "12.50", discount: "15" })).toEqual({ monthlyPriceMinor: 1250, annualDiscountPercent: 15 });
    expect(validatePlanPriceForm({ price: " ", discount: "0" })).toEqual({ monthlyPriceMinor: null, annualDiscountPercent: 0 });
    expect(validatePlanPriceForm({ price: "-1", discount: "20" })).toHaveProperty("error");
    expect(validatePlanPriceForm({ price: "499", discount: "101" })).toHaveProperty("error");
    expect(validatePlanPriceForm({ price: "499", discount: "12.5" })).toHaveProperty("error");
  });

  it("knows when a row was edited", () => {
    expect(isDirty({ price: "499", discount: "20" }, ROW)).toBe(false);
    expect(isDirty({ price: "599", discount: "20" }, ROW)).toBe(true);
  });
});

describe("reader prices", () => {
  const READER: ReaderPriceView = { country: "AU", model: "s700", displayName: "Stripe Reader S700", priceMinor: "34900", updatedAt: "" };

  it("shows a string or number price as major units, blank when not for sale", () => {
    expect(readerPriceForm(READER)).toBe("349");
    expect(readerPriceForm({ ...READER, priceMinor: 34950 })).toBe("349.5");
    expect(readerPriceForm({ ...READER, priceMinor: null })).toBe("");
  });

  it("validates a reader price", () => {
    expect(validateReaderPrice("349.50")).toEqual({ priceMinor: 34950 });
    expect(validateReaderPrice(" ")).toEqual({ priceMinor: null });
    expect(validateReaderPrice("0")).toHaveProperty("error");
    expect(validateReaderPrice("abc")).toHaveProperty("error");
  });
});
