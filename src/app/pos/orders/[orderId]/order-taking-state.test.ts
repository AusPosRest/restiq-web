import { describe, expect, it } from "vitest";
import {
  canConfirmSelection,
  computeOrderTotalMinor,
  computeUnitTotalMinor,
  emptyModifierSelection,
  filterMenuItems,
  formatPriceMinor,
  isGroupSatisfied,
  modifierGroupBadgeLabel,
  resolveSelectedModifiers,
  resolveUnitPriceMinor,
  toggleModifier,
  variantSatisfied,
  type ModifierSelection,
  type OrderLineView,
  type PosMenuItemView,
} from "./order-taking-state";

const SPICE_GROUP = {
  id: "g-spice",
  name: "Spice Level",
  minSelections: 1,
  maxSelections: 1,
  modifiers: [
    { id: "m-mild", name: "Mild", priceMinor: 0 },
    { id: "m-medium", name: "Medium", priceMinor: 0 },
  ],
};

const ADDONS_GROUP = {
  id: "g-addons",
  name: "Add-ons",
  minSelections: 0,
  maxSelections: 3,
  modifiers: [
    { id: "m-chutney", name: "Extra Mint Chutney", priceMinor: 2000 },
    { id: "m-onion", name: "Onion Salad", priceMinor: 3000 },
    { id: "m-butter", name: "Butter", priceMinor: 1500 },
    { id: "m-cheese", name: "Cheese", priceMinor: 4000 },
  ],
};

const PANEER_TIKKA: PosMenuItemView = {
  id: "item-paneer",
  categoryId: "cat-tandoor",
  name: "Paneer Tikka",
  shortName: "Paneer Tikka",
  available: true,
  priceMinor: null,
  variants: [
    { id: "v-half", name: "Half", priceMinor: 34000 },
    { id: "v-full", name: "Full", priceMinor: 56000 },
  ],
  modifierGroups: [SPICE_GROUP, ADDONS_GROUP],
};

const BUTTER_NAAN: PosMenuItemView = {
  id: "item-naan",
  categoryId: "cat-breads",
  name: "Butter Naan",
  shortName: "Butter Naan",
  available: true,
  priceMinor: 14000,
  variants: [],
  modifierGroups: [],
};

describe("formatPriceMinor", () => {
  it("renders whole-currency-unit amounts, no decimals", () => {
    expect(formatPriceMinor(34000)).toBe("₹340");
    expect(formatPriceMinor(0)).toBe("₹0");
  });

  it("falls back to the currency code for an unknown symbol", () => {
    expect(formatPriceMinor(500, "AUD")).toBe("AUD 5");
  });
});

describe("filterMenuItems", () => {
  const items = [PANEER_TIKKA, BUTTER_NAAN];

  it("filters by the active category when the search query is empty", () => {
    expect(filterMenuItems(items, "cat-breads", "")).toEqual([BUTTER_NAAN]);
  });

  it("searches across every category once a query is typed, ignoring the active tab", () => {
    expect(filterMenuItems(items, "cat-breads", "paneer")).toEqual([PANEER_TIKKA]);
  });

  it("search is case-insensitive", () => {
    expect(filterMenuItems(items, null, "PANEER")).toEqual([PANEER_TIKKA]);
  });
});

describe("modifierGroupBadgeLabel", () => {
  it("labels a required exact-count group", () => {
    expect(modifierGroupBadgeLabel({ minSelections: 1, maxSelections: 1 })).toBe("Required · choose 1");
  });

  it("labels an optional up-to group", () => {
    expect(modifierGroupBadgeLabel({ minSelections: 0, maxSelections: 3 })).toBe("Optional · up to 3");
  });

  it("labels a required range group", () => {
    expect(modifierGroupBadgeLabel({ minSelections: 1, maxSelections: 2 })).toBe("Required · choose 1-2");
  });
});

describe("toggleModifier", () => {
  it("single-select groups (max <= 1) replace the prior selection", () => {
    expect(toggleModifier(["m-mild"], "m-medium", 1)).toEqual(["m-medium"]);
  });

  it("multi-select groups add up to the cap", () => {
    expect(toggleModifier(["m-chutney"], "m-onion", 3)).toEqual(["m-chutney", "m-onion"]);
  });

  it("multi-select groups ignore a tap past the cap", () => {
    expect(toggleModifier(["m-chutney", "m-onion", "m-butter"], "m-cheese", 3)).toEqual(["m-chutney", "m-onion", "m-butter"]);
  });

  it("removes an already-selected chip regardless of the cap", () => {
    expect(toggleModifier(["m-chutney", "m-onion"], "m-chutney", 3)).toEqual(["m-onion"]);
  });
});

describe("isGroupSatisfied / variantSatisfied / canConfirmSelection", () => {
  it("a required group with nothing selected is unsatisfied", () => {
    expect(isGroupSatisfied(SPICE_GROUP, [])).toBe(false);
  });

  it("a required group with exactly min selected is satisfied", () => {
    expect(isGroupSatisfied(SPICE_GROUP, ["m-mild"])).toBe(true);
  });

  it("an optional group with nothing selected is satisfied", () => {
    expect(isGroupSatisfied(ADDONS_GROUP, [])).toBe(true);
  });

  it("an item with variants is unsatisfied until one is chosen", () => {
    expect(variantSatisfied(PANEER_TIKKA, null)).toBe(false);
    expect(variantSatisfied(PANEER_TIKKA, "v-half")).toBe(true);
  });

  it("an item with no variants is always variant-satisfied", () => {
    expect(variantSatisfied(BUTTER_NAAN, null)).toBe(true);
  });

  it("blocks confirm until the required spice group is satisfied, even with a variant chosen", () => {
    const selection = emptyModifierSelection(PANEER_TIKKA);
    expect(canConfirmSelection(PANEER_TIKKA, selection, "v-half")).toBe(false);
  });

  it("blocks confirm until a variant is chosen, even with every modifier group satisfied", () => {
    const selection: ModifierSelection = { "g-spice": ["m-mild"], "g-addons": [] };
    expect(canConfirmSelection(PANEER_TIKKA, selection, null)).toBe(false);
  });

  it("allows confirm once the variant and every required group are satisfied", () => {
    const selection: ModifierSelection = { "g-spice": ["m-mild"], "g-addons": ["m-chutney"] };
    expect(canConfirmSelection(PANEER_TIKKA, selection, "v-half")).toBe(true);
  });

  it("an item with no modifier groups and no variants is always confirmable", () => {
    expect(canConfirmSelection(BUTTER_NAAN, emptyModifierSelection(BUTTER_NAAN), null)).toBe(true);
  });
});

describe("price resolution", () => {
  it("resolves the chosen variant's price for a varianted item", () => {
    expect(resolveUnitPriceMinor(PANEER_TIKKA, "v-full")).toBe(56000);
  });

  it("resolves 0 when a varianted item has no variant chosen yet", () => {
    expect(resolveUnitPriceMinor(PANEER_TIKKA, null)).toBe(0);
  });

  it("resolves the base price for an unvaried item", () => {
    expect(resolveUnitPriceMinor(BUTTER_NAAN, null)).toBe(14000);
  });

  it("collects the selected modifiers across every group, in each group's own defined modifier order", () => {
    const selection: ModifierSelection = { "g-spice": ["m-medium"], "g-addons": ["m-cheese", "m-butter"] };
    expect(resolveSelectedModifiers(PANEER_TIKKA, selection).map((m) => m.id)).toEqual(["m-medium", "m-butter", "m-cheese"]);
  });

  it("sums the unit price and every selected modifier's price", () => {
    const modifiers = [
      { id: "m-medium", name: "Medium", priceMinor: 0 },
      { id: "m-cheese", name: "Cheese", priceMinor: 4000 },
    ];
    expect(computeUnitTotalMinor(34000, modifiers)).toBe(38000);
  });
});

describe("computeOrderTotalMinor", () => {
  it("sums every line's total", () => {
    const lines: Pick<OrderLineView, "lineTotalMinor">[] = [{ lineTotalMinor: 14000 }, { lineTotalMinor: 76000 }];
    expect(computeOrderTotalMinor(lines as OrderLineView[])).toBe(90000);
  });

  it("is 0 for an empty order", () => {
    expect(computeOrderTotalMinor([])).toBe(0);
  });
});
