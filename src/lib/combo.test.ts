import { describe, expect, it } from "vitest";
import {
  canAddCombo,
  changePick,
  type ComboItemInfo,
  type ComboMenuView,
  comboSavingsMinor,
  combosFor,
  comboUnitPriceMinor,
  initialPicks,
  toggleGroupModifier,
  toSelections,
} from "./combo";

const opt = (id: string, itemId: string, upchargeMinor = 0, available = true) => ({ id, itemId, itemName: itemId, variantId: null, variantName: null, upchargeMinor, available });

const thali: ComboMenuView = {
  id: "thali",
  categoryId: "mains",
  name: "Thali Meal",
  photoUrl: null,
  priceMinor: 34900,
  currency: "INR",
  available: true,
  slots: [
    { id: "main", name: "Main", pickCount: 1, options: [opt("o-bc", "butter-chicken"), opt("o-pt", "paneer")] },
    { id: "bread", name: "Bread", pickCount: 2, options: [opt("o-gn", "naan"), opt("o-br", "roti")] },
    { id: "drink", name: "Drink", pickCount: 1, options: [opt("o-ml", "lassi", 3000), opt("o-ch", "chai", 0, false)] },
    { id: "dessert", name: "Dessert", pickCount: 1, options: [opt("o-gj", "jamun")] },
  ],
};

const spice = { id: "spice", name: "Spice", minSelections: 1, maxSelections: 1, modifiers: [{ id: "mild", name: "Mild", priceMinor: 0 }, { id: "butter", name: "Extra butter", priceMinor: 2000 }] };
const item = (id: string, priceMinor: number, modifierGroups: ComboItemInfo["modifierGroups"] = []): ComboItemInfo => ({ id, priceMinor, variants: [], modifierGroups });
const items = new Map<string, ComboItemInfo>([
  ["butter-chicken", item("butter-chicken", 38000, [spice])],
  ["paneer", item("paneer", 34000)],
  ["naan", item("naan", 9000)],
  ["roti", item("roti", 4000)],
  ["lassi", item("lassi", 12000)],
  ["chai", item("chai", 6000)],
  ["jamun", item("jamun", 16000)],
]);

describe("combo picking (restiq-web#264)", () => {
  it("starts with fixed slots filled and every choice slot empty", () => {
    expect(initialPicks(thali)).toEqual({ "o-gj": { quantity: 1, modifierIds: [] } });
    expect(canAddCombo(thali, initialPicks(thali), items)).toBe(false);
  });

  it("swaps within a pick-1 slot and counts up to the cap in a pick-N slot", () => {
    let picks = changePick(thali.slots[0], initialPicks(thali), "o-bc", 1);
    picks = changePick(thali.slots[0], picks, "o-pt", 1);
    expect(picks["o-bc"]).toBeUndefined();
    expect(picks["o-pt"].quantity).toBe(1);

    const bread = thali.slots[1];
    picks = changePick(bread, picks, "o-gn", 1);
    picks = changePick(bread, picks, "o-gn", 1);
    expect(changePick(bread, picks, "o-br", 1)).toBe(picks); // already 2 of 2
    picks = changePick(bread, picks, "o-gn", -1);
    picks = changePick(bread, picks, "o-br", 1);
    expect([picks["o-gn"].quantity, picks["o-br"].quantity]).toEqual([1, 1]);
  });

  it("needs every slot filled and required modifiers chosen, then prices extras and paid modifiers", () => {
    let picks = initialPicks(thali);
    picks = changePick(thali.slots[0], picks, "o-bc", 1);
    picks = changePick(thali.slots[1], picks, "o-gn", 1);
    picks = changePick(thali.slots[1], picks, "o-gn", 1);
    picks = changePick(thali.slots[2], picks, "o-ml", 1);
    expect(canAddCombo(thali, picks, items)).toBe(false); // butter chicken's spice is required

    picks = toggleGroupModifier(picks, "o-bc", spice, "mild");
    picks = toggleGroupModifier(picks, "o-bc", spice, "butter"); // pick-1 group swaps
    expect(picks["o-bc"].modifierIds).toEqual(["butter"]);
    expect(canAddCombo(thali, picks, items)).toBe(true);
    expect(comboUnitPriceMinor(thali, picks, items)).toBe(34900 + 3000 + 2000);
    expect(toSelections(thali, picks)).toEqual([
      { optionId: "o-bc", quantity: 1, modifierIds: ["butter"] },
      { optionId: "o-gn", quantity: 2, modifierIds: [] },
      { optionId: "o-ml", quantity: 1, modifierIds: [] },
      { optionId: "o-gj", quantity: 1, modifierIds: [] },
    ]);
  });

  it("won't add a sold-out option or a combo that is off", () => {
    let picks = initialPicks(thali);
    picks = changePick(thali.slots[0], picks, "o-pt", 1);
    picks = changePick(thali.slots[1], picks, "o-br", 1);
    picks = changePick(thali.slots[1], picks, "o-br", 1);
    const withChai = changePick(thali.slots[2], picks, "o-ch", 1);
    expect(canAddCombo(thali, withChai, items)).toBe(false);
    const withLassi = changePick(thali.slots[2], picks, "o-ml", 1);
    expect(canAddCombo(thali, withLassi, items)).toBe(true);
    expect(canAddCombo({ ...thali, available: false }, withLassi, items)).toBe(false);
  });

  it("works out savings against the default picks bought separately", () => {
    // 380 + 2 x 90 + 120 + 160 = 840 a la carte, combo 349.
    expect(comboSavingsMinor(thali, items)).toBe(84000 - 34900);
    expect(comboSavingsMinor({ ...thali, priceMinor: 99900 }, items)).toBe(0);
    expect(comboSavingsMinor(thali, new Map())).toBe(0);
  });

  it("lists combos by category, or by name when searching", () => {
    expect(combosFor([thali], "mains", "").map((c) => c.id)).toEqual(["thali"]);
    expect(combosFor([thali], "drinks", "")).toEqual([]);
    expect(combosFor([thali], "drinks", "thal").map((c) => c.id)).toEqual(["thali"]);
    expect(combosFor(undefined, "mains", "")).toEqual([]);
  });
});
