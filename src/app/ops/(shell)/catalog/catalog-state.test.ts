import { describe, expect, it } from "vitest";
import { CatalogProduct, EMPTY_FORM, formFromProduct, parseTags, productsQuery, validateProductForm } from "./catalog-state";

const PRODUCT: CatalogProduct = {
  id: "p1",
  name: "Paneer Tikka",
  shortName: "Pnr Tikka",
  nameHindi: null,
  vegMarker: "veg",
  photoUrl: null,
  category: "Starters",
  suggestedPriceMinor: 24900,
  currency: "INR",
  tags: ["veg", "grill"],
  updatedAt: "2026-09-16T00:00:00.000Z",
};

describe("catalog-state", () => {
  it("round-trips a product through the form", () => {
    const form = formFromProduct(PRODUCT);
    expect(form.price).toBe("249");
    expect(form.tags).toBe("veg, grill");
    const result = validateProductForm(form);
    expect(result).toEqual({ payload: { ...PRODUCT, id: undefined, updatedAt: undefined, tags: ["veg", "grill"] } });
  });

  it("normalises tags and rejects bad input", () => {
    expect(parseTags(" Veg, grill ,,VEG")).toEqual(["veg", "grill"]);
    expect(validateProductForm(EMPTY_FORM)).toEqual({ error: "Name is required." });
    expect(validateProductForm({ ...EMPTY_FORM, name: "x", shortName: "x", category: "c", price: "-1" })).toEqual({ error: "Enter a price of 0 or more." });
    expect(validateProductForm({ ...EMPTY_FORM, name: "x", shortName: "x", category: "c", price: "12.5", photoUrl: "http://x" })).toEqual({ error: "Photo must be an https URL." });
    const ok = validateProductForm({ ...EMPTY_FORM, name: "x", shortName: "x", category: "c", price: "12.5", currency: "AUD" });
    expect("payload" in ok && ok.payload.suggestedPriceMinor).toBe(1250);
  });

  it("builds the list query", () => {
    expect(productsQuery("", "", "")).toBe("catalog/products");
    expect(productsQuery(" pie ", "bakery", "AUD")).toBe("catalog/products?q=pie&tag=bakery&currency=AUD");
  });
});
