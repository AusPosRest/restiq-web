import { describe, expect, it } from "vitest";
import { describeSlots, draftFromCombo, filterCombos, toSaveComboInput, validateComboDraft } from "./combo-editor-state";
import type { ComboView } from "./menu-state";

const option = (id: string, itemName: string, upchargeMinor = 0) => ({ id, itemId: `i-${id}`, itemName, variantId: null, variantName: null, upchargeMinor, available: true });

const thali: ComboView = {
  id: "c1",
  categoryId: "cat1",
  name: "Thali Meal",
  photoUrl: null,
  priceMinor: 34900,
  currency: "INR",
  available: true,
  slots: [
    { id: "s1", name: "Main", pickCount: 1, options: [option("o1", "Butter chicken"), option("o2", "Paneer tikka")] },
    { id: "s2", name: "Drink", pickCount: 1, options: [option("o3", "Mango lassi", 3000), option("o4", "Chai")] },
    { id: "s3", name: "Dessert", pickCount: 1, options: [option("o5", "Gulab jamun")] },
  ],
};

describe("combo editor state (restiq-web#264)", () => {
  it("round-trips a saved combo into the save payload", () => {
    const input = toSaveComboInput(draftFromCombo(thali, ""), "INR");
    expect(input).toMatchObject({ name: "Thali Meal", categoryId: "cat1", priceMinor: 34900, currency: "INR", available: true });
    expect(input.slots.map((s) => [s.name, s.pickCount, s.options.length])).toEqual([
      ["Main", 1, 2],
      ["Drink", 1, 2],
      ["Dessert", 1, 1],
    ]);
    expect(input.slots[1].options[0]).toEqual({ itemId: "i-o3", upchargeMinor: 3000 });
  });

  it("keeps a photo on save and drops it when removed", () => {
    const withPhoto = draftFromCombo({ ...thali, photoUrl: "data:image/jpeg;base64,AAAA" }, "");
    expect(toSaveComboInput(withPhoto, "INR").photoUrl).toBe("data:image/jpeg;base64,AAAA");
    expect(toSaveComboInput({ ...withPhoto, photoUrl: null }, "INR")).not.toHaveProperty("photoUrl");
  });

  it("starts a new combo with one empty slot and flags every missing field", () => {
    const draft = draftFromCombo(null, "cat1");
    expect(draft.slots).toHaveLength(1);
    const errors = validateComboDraft(draft);
    expect(errors.name).toBeTruthy();
    expect(errors.price).toBeTruthy();
    expect(Object.values(errors.slotErrors ?? {})).toEqual(["Name this slot"]);
  });

  it("rejects a slot with no items, a zero pick count, or a non-numeric extra charge", () => {
    const base = draftFromCombo(thali, "");
    const [main, drink, dessert] = base.slots;
    expect(validateComboDraft({ ...base, slots: [{ ...main, options: [] }] }).slotErrors).toEqual({ [main.key]: "Add at least one item" });
    expect(validateComboDraft({ ...base, slots: [{ ...main, pickCount: "0" }] }).slotErrors).toEqual({ [main.key]: "Pick at least 1" });
    expect(validateComboDraft({ ...base, slots: [{ ...drink, options: [{ ...drink.options[0], upcharge: "abc" }] }] }).slotErrors).toEqual({
      [drink.key]: "Extra charges must be amounts",
    });
    expect(validateComboDraft({ ...base, slots: [] }).slots).toBe("Add at least one slot");
    expect(validateComboDraft({ ...base, slots: [dessert] })).toEqual({});
  });

  it("summarises slots for the combo list", () => {
    expect(describeSlots(thali)).toBe("Main: pick 1 of 2 · Drink: pick 1 of 2 · Dessert: Gulab jamun");
  });

  it("searches combos by name, slot name or item in a slot", () => {
    const coffee: ComboView = { ...thali, id: "c2", name: "Coffee & cake" };
    const all = [thali, coffee];
    expect(filterCombos(all, "").map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(filterCombos(all, "  thali ").map((c) => c.id)).toEqual(["c1"]);
    expect(filterCombos(all, "COFFEE").map((c) => c.id)).toEqual(["c2"]);
    expect(filterCombos(all, "dessert").map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(filterCombos(all, "gulab")).toHaveLength(2);
    expect(filterCombos(all, "pizza")).toEqual([]);
  });
});
