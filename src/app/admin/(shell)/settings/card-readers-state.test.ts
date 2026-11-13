import { describe, expect, it } from "vitest";
import type { ReaderPriceView } from "@/lib/card-readers";
import { emptyOrderForm, orderTotalMinor, progressIndex, validateOrderForm, type OrderForm } from "./card-readers-state";

const PRICES: ReaderPriceView[] = [{ country: "AU", model: "s700", displayName: "Stripe Reader S700", priceMinor: "34900", updatedAt: "" }];

const FILLED: OrderForm = {
  ...emptyOrderForm("o1", "1 George St"),
  model: "s700",
  quantity: 2,
  shipping: { name: " Sam Lee ", line1: "1 George St", line2: "", city: "Sydney", state: "NSW", postcode: "2000", phone: "+61 400 000 000" },
};

describe("card-readers-state", () => {
  it("totals unit price x quantity, null until a priced model is chosen", () => {
    expect(orderTotalMinor(PRICES, "s700", 3)).toBe(104700);
    expect(orderTotalMinor(PRICES, "", 1)).toBeNull();
    expect(orderTotalMinor(PRICES, "wisepos_e", 1)).toBeNull();
  });

  it("builds a trimmed order body and leaves out a blank line 2", () => {
    expect(validateOrderForm(FILLED, PRICES)).toEqual({
      outletId: "o1",
      model: "s700",
      quantity: 2,
      shipping: { name: "Sam Lee", line1: "1 George St", city: "Sydney", state: "NSW", postcode: "2000", phone: "+61 400 000 000" },
    });
    expect(validateOrderForm({ ...FILLED, shipping: { ...FILLED.shipping, line2: "Level 2" } }, PRICES)).toMatchObject({ shipping: { line2: "Level 2" } });
  });

  it("rejects a bad form", () => {
    expect(validateOrderForm({ ...FILLED, model: "wisepos_e" }, PRICES)).toHaveProperty("error");
    expect(validateOrderForm({ ...FILLED, quantity: 6 }, PRICES)).toHaveProperty("error");
    expect(validateOrderForm({ ...FILLED, quantity: 0 }, PRICES)).toHaveProperty("error");
    expect(validateOrderForm({ ...FILLED, outletId: "" }, PRICES)).toHaveProperty("error");
    expect(validateOrderForm({ ...FILLED, shipping: { ...FILLED.shipping, city: " " } }, PRICES)).toHaveProperty("error");
    expect(validateOrderForm({ ...FILLED, shipping: { ...FILLED.shipping, postcode: "NSW1" } }, PRICES)).toHaveProperty("error");
    expect(validateOrderForm({ ...FILLED, shipping: { ...FILLED.shipping, phone: "call me" } }, PRICES)).toHaveProperty("error");
  });

  it("places an order on its progress line, or off it when it stopped", () => {
    expect(progressIndex("paid")).toBe(0);
    expect(progressIndex("delivered")).toBe(3);
    expect(progressIndex("payment_failed")).toBeNull();
    expect(progressIndex("cancelled")).toBeNull();
  });
});
