import { describe, expect, it } from "vitest";
import {
  canAddToCart,
  computeUnitTotalMinor,
  displayPriceInfo,
  emptyModifierSelection,
  formatPriceMinor,
  initialLetterTile,
  isGroupSatisfied,
  type MenuItemView,
  modifierGroupBadgeLabel,
  nonEmptyCategories,
  resolveSelectedModifiers,
  resolveUnitPriceMinor,
  toggleModifier,
  visibleItems,
} from "./menu-state";

function item(overrides: Partial<MenuItemView> = {}): MenuItemView {
  return {
    id: "item-1",
    categoryId: "cat-1",
    name: "Paneer Tikka",
    shortName: "Paneer Tikka",
    available: true,
    priceMinor: 32000,
    currency: "INR",
    variants: [],
    modifierGroups: [],
    allergens: [],
    ...overrides,
  };
}

describe("formatPriceMinor", () => {
  it("renders whole-currency-unit prices with the right symbol", () => {
    expect(formatPriceMinor(32000, "INR")).toBe("₹320");
  });

  it("falls back to the currency code for an unmapped currency", () => {
    expect(formatPriceMinor(500, "USD")).toBe("USD 5");
  });
});

describe("nonEmptyCategories", () => {
  it("skips a category with no items rather than showing it hollow", () => {
    const categories = [
      { id: "c1", name: "Starters", sortOrder: 0, items: [item()] },
      { id: "c2", name: "Empty", sortOrder: 1, items: [] },
    ];
    expect(nonEmptyCategories(categories).map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("displayPriceInfo", () => {
  it("returns the item's own price when it has no variants", () => {
    expect(displayPriceInfo(item())).toEqual({ priceMinor: 32000, currency: "INR" });
  });

  it("returns the cheapest currently-priced variant", () => {
    const withVariants = item({
      priceMinor: null,
      currency: null,
      variants: [
        { id: "v-full", name: "Full", sortOrder: 1, priceMinor: 48000, currency: "INR" },
        { id: "v-half", name: "Half", sortOrder: 0, priceMinor: 32000, currency: "INR" },
      ],
    });
    expect(displayPriceInfo(withVariants)).toEqual({ priceMinor: 32000, currency: "INR" });
  });

  it("returns null rather than inventing a price when nothing is priced", () => {
    expect(displayPriceInfo(item({ priceMinor: null, currency: null }))).toBeNull();
    const unpriced = item({
      priceMinor: null,
      currency: null,
      variants: [{ id: "v1", name: "Half", sortOrder: 0, priceMinor: null, currency: null }],
    });
    expect(displayPriceInfo(unpriced)).toBeNull();
  });
});

describe("visibleItems", () => {
  const categories = [
    { id: "c1", name: "Starters", sortOrder: 0, items: [item({ id: "i1", categoryId: "c1", name: "Paneer Tikka" })] },
    { id: "c2", name: "Mains", sortOrder: 1, items: [item({ id: "i2", categoryId: "c2", name: "Butter Chicken" })] },
  ];

  it("filters to the active category when the search query is empty", () => {
    expect(visibleItems(categories, "c2", "").map((i) => i.id)).toEqual(["i2"]);
  });

  it("returns everything when no category is active and there is no query", () => {
    expect(visibleItems(categories, null, "").map((i) => i.id)).toEqual(["i1", "i2"]);
  });

  it("searches across every category regardless of the active tab", () => {
    expect(visibleItems(categories, "c1", "butter").map((i) => i.id)).toEqual(["i2"]);
  });
});

describe("initialLetterTile", () => {
  it("uppercases the first letter of the dish name", () => {
    expect(initialLetterTile("paneer tikka")).toBe("P");
  });
});

describe("modifier selection", () => {
  const group = { id: "g1", name: "Spice Level", minSelections: 1, maxSelections: 1, modifiers: [] };

  it("badges required single-select groups", () => {
    expect(modifierGroupBadgeLabel(group)).toBe("Required · choose 1");
  });

  it("badges optional groups with a cap", () => {
    expect(modifierGroupBadgeLabel({ minSelections: 0, maxSelections: 3 })).toBe("Optional · up to 3");
  });

  it("badges purely optional groups", () => {
    expect(modifierGroupBadgeLabel({ minSelections: 0, maxSelections: 0 })).toBe("Optional");
  });

  it("toggleModifier replaces the selection for a single-select group", () => {
    expect(toggleModifier(["a"], "b", 1)).toEqual(["b"]);
  });

  it("toggleModifier caps a multi-select group", () => {
    expect(toggleModifier(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  it("toggleModifier removes an already-selected chip", () => {
    expect(toggleModifier(["a", "b"], "a", 2)).toEqual(["b"]);
  });

  it("isGroupSatisfied enforces both min and max", () => {
    expect(isGroupSatisfied({ minSelections: 1, maxSelections: 2 }, [])).toBe(false);
    expect(isGroupSatisfied({ minSelections: 1, maxSelections: 2 }, ["a"])).toBe(true);
    expect(isGroupSatisfied({ minSelections: 1, maxSelections: 2 }, ["a", "b", "c"])).toBe(false);
  });
});

describe("canAddToCart", () => {
  it("is false for an unavailable item regardless of selection", () => {
    expect(canAddToCart(item({ available: false }), {}, null)).toBe(false);
  });

  it("is false when a variant is required but unselected", () => {
    const withVariant = item({ variants: [{ id: "v1", name: "Half", sortOrder: 0, priceMinor: 32000, currency: "INR" }] });
    expect(canAddToCart(withVariant, {}, null)).toBe(false);
    expect(canAddToCart(withVariant, {}, "v1")).toBe(true);
  });

  it("is false when a required modifier group is unsatisfied", () => {
    const withGroup = item({ modifierGroups: [{ id: "g1", name: "Spice", minSelections: 1, maxSelections: 1, modifiers: [] }] });
    expect(canAddToCart(withGroup, emptyModifierSelection(withGroup), null)).toBe(false);
    expect(canAddToCart(withGroup, { g1: ["mild"] }, null)).toBe(true);
  });

  it("is true for a simple item with nothing to configure", () => {
    expect(canAddToCart(item(), {}, null)).toBe(true);
  });
});

describe("price resolution and totals", () => {
  it("resolveUnitPriceMinor returns null when a variant is required but not selected", () => {
    const withVariant = item({ priceMinor: null, currency: null, variants: [{ id: "v1", name: "Half", sortOrder: 0, priceMinor: 32000, currency: "INR" }] });
    expect(resolveUnitPriceMinor(withVariant, null)).toBeNull();
    expect(resolveUnitPriceMinor(withVariant, "v1")).toEqual({ priceMinor: 32000, currency: "INR" });
  });

  it("resolveSelectedModifiers pulls only the selected ids in order", () => {
    const withGroup = item({
      modifierGroups: [
        {
          id: "g1",
          name: "Add-ons",
          minSelections: 0,
          maxSelections: 2,
          modifiers: [
            { id: "m1", name: "Extra cheese", priceMinor: 5000 },
            { id: "m2", name: "Extra spicy", priceMinor: 0 },
          ],
        },
      ],
    });
    expect(resolveSelectedModifiers(withGroup, { g1: ["m2"] })).toEqual([{ id: "m2", name: "Extra spicy", priceMinor: 0 }]);
  });

  it("computeUnitTotalMinor sums the unit price and every selected modifier", () => {
    expect(computeUnitTotalMinor(32000, [{ id: "m1", name: "Extra cheese", priceMinor: 5000 }])).toBe(37000);
  });
});
