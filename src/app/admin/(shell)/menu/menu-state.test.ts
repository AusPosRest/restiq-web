import { describe, expect, it } from "vitest";
import {
  ALL_CATEGORY,
  combosForItem,
  formatEffectiveDate,
  formatPriceMinor,
  ItemView,
  majorStringToPriceMinor,
  parseMenuQuery,
  pendingChangeFor,
  toMenuUrlParams,
  validateModifierGroup,
  visibleItems,
} from "./menu-state";

function item(overrides: Partial<ItemView> = {}): ItemView {
  return {
    id: "i1",
    name: "Paneer Tikka",
    shortName: "Paneer Tikka",
    categoryId: "tandoor",
    available: true,
    variants: [],
    modifierGroups: [],
    allergens: [],
    ...overrides,
  };
}

describe("formatPriceMinor", () => {
  it("renders INR with a rupee symbol and no decimals", () => {
    expect(formatPriceMinor(18000, "INR")).toBe("₹180");
  });

  it("falls back to the currency code for an unmapped currency", () => {
    expect(formatPriceMinor(500, "SGD")).toBe("SGD 5");
  });
});

describe("majorStringToPriceMinor", () => {
  it("converts a major-unit string to minor units", () => {
    expect(majorStringToPriceMinor("180.50")).toBe(18050);
  });

  it("rejects a negative amount", () => {
    expect(majorStringToPriceMinor("-5")).toBeNull();
  });

  it("rejects a non-numeric string", () => {
    expect(majorStringToPriceMinor("abc")).toBeNull();
  });
});

describe("pendingChangeFor", () => {
  const pending = [{ variantId: null, channel: "dine_in" as const, priceMinor: 100, currency: "INR", effectiveAt: "2026-09-01T00:00:00.000Z" }];

  it("finds the pending change matching variant + channel", () => {
    expect(pendingChangeFor(pending, null, "dine_in")?.priceMinor).toBe(100);
  });

  it("returns null when nothing matches", () => {
    expect(pendingChangeFor(pending, null, "delivery")).toBeNull();
    expect(pendingChangeFor(pending, "v1", "dine_in")).toBeNull();
  });
});

describe("formatEffectiveDate", () => {
  it("renders a short day-month date", () => {
    expect(formatEffectiveDate("2026-09-01T00:00:00.000Z")).toMatch(/1 Sep|Sep 1/);
  });
});

describe("menu query state", () => {
  it("defaults to the all-category filter with no search", () => {
    expect(parseMenuQuery(new URLSearchParams())).toEqual({ category: ALL_CATEGORY, q: "" });
  });

  it("round-trips a category and search term through the URL", () => {
    const query = { category: "tandoor", q: "tikka" };
    const params = toMenuUrlParams(query);
    expect(parseMenuQuery(params)).toEqual(query);
  });

  it("omits the category param when it is the all-category default", () => {
    expect(toMenuUrlParams({ category: ALL_CATEGORY, q: "" }).toString()).toBe("");
  });
});

describe("visibleItems", () => {
  const items = [
    item({ id: "1", name: "Paneer Tikka", shortName: "Paneer Tikka", categoryId: "tandoor" }),
    item({ id: "2", name: "Chicken Tikka", shortName: "Chicken Tikka", categoryId: "tandoor" }),
    item({ id: "3", name: "Dal Makhani", shortName: "Dal Makhani", categoryId: "mains" }),
  ];

  it("returns every item for the all-category filter", () => {
    expect(visibleItems(items, { category: ALL_CATEGORY, q: "" })).toHaveLength(3);
  });

  it("filters to a single category", () => {
    expect(visibleItems(items, { category: "mains", q: "" }).map((i) => i.id)).toEqual(["3"]);
  });

  it("searches across name and short name, case-insensitively", () => {
    expect(visibleItems(items, { category: ALL_CATEGORY, q: "tikka" }).map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("combines category and search filters", () => {
    expect(visibleItems(items, { category: "tandoor", q: "chicken" }).map((i) => i.id)).toEqual(["2"]);
  });
});

describe("validateModifierGroup", () => {
  const base = { name: "Spice Level", minSelections: 1, maxSelections: 1, modifiers: [{ id: "o1", name: "Mild", priceMinor: 0 }] };

  it("is valid for a well-formed single-select group", () => {
    expect(validateModifierGroup(base)).toEqual({});
  });

  it("requires a name", () => {
    expect(validateModifierGroup({ ...base, name: "  " }).name).toBe("Name this modifier group.");
  });

  it("requires at least one option", () => {
    expect(validateModifierGroup({ ...base, modifiers: [] }).options).toBe("Add at least one option.");
  });

  it("rejects a negative minimum", () => {
    expect(validateModifierGroup({ ...base, minSelections: -1 }).min).toBe("Minimum can't be negative.");
  });

  it("rejects a maximum below 1", () => {
    expect(validateModifierGroup({ ...base, minSelections: 0, maxSelections: 0 }).max).toBe("Maximum must be at least 1.");
  });

  it("rejects a maximum below the minimum", () => {
    expect(validateModifierGroup({ ...base, minSelections: 2, maxSelections: 1 }).max).toBe("Maximum can't be less than minimum.");
  });

  it("rejects a maximum greater than the number of options", () => {
    expect(validateModifierGroup({ ...base, minSelections: 0, maxSelections: 3 }).max).toBe("Maximum can't exceed the number of options (1).");
  });

  it("allows a multi-select group whose max matches its option count", () => {
    const multi = {
      name: "Add-ons",
      minSelections: 0,
      maxSelections: 2,
      modifiers: [
        { id: "o1", name: "Extra cheese", priceMinor: 5000 },
        { id: "o2", name: "Extra sauce", priceMinor: 3000 },
      ],
    };
    expect(validateModifierGroup(multi)).toEqual({});
  });
});

describe("combosForItem", () => {
  it("returns only combos whose components include the item", () => {
    const combos = [
      { id: "c1", name: "Thali", categoryId: null, priceMinor: 1, currency: "INR", components: [{ itemId: "i1", quantity: 1 }] },
      { id: "c2", name: "Other", categoryId: null, priceMinor: 1, currency: "INR", components: [{ itemId: "i2", quantity: 1 }] },
    ];
    expect(combosForItem(combos, "i1").map((c) => c.id)).toEqual(["c1"]);
  });
});
