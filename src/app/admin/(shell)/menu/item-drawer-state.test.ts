import { describe, expect, it } from "vitest";
import { itemDraftFromView, itemDraftIsValid, toggleId, validateItemDraft } from "./item-drawer-state";
import { ItemView } from "./menu-state";

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

describe("itemDraftFromView", () => {
  it("defaults a create-mode draft to the given category with blank fields", () => {
    expect(itemDraftFromView(null, "tandoor")).toEqual({ name: "", shortName: "", categoryId: "tandoor" });
  });

  it("derives an edit-mode draft from the item's routine fields", () => {
    expect(itemDraftFromView(item(), "tandoor")).toEqual({ name: "Paneer Tikka", shortName: "Paneer Tikka", categoryId: "tandoor" });
  });
});

describe("validateItemDraft / itemDraftIsValid", () => {
  const base = itemDraftFromView(item(), "tandoor");

  it("is valid for a well-formed draft", () => {
    expect(validateItemDraft(base)).toEqual({});
    expect(itemDraftIsValid(base)).toBe(true);
  });

  it("requires a name", () => {
    expect(validateItemDraft({ ...base, name: " " }).name).toBe("Name the item.");
    expect(itemDraftIsValid({ ...base, name: " " })).toBe(false);
  });

  it("requires a kitchen ticket name", () => {
    expect(validateItemDraft({ ...base, shortName: "" }).shortName).toBe("Add a kitchen ticket name.");
  });

  it("requires a category", () => {
    expect(validateItemDraft({ ...base, categoryId: "" }).category).toBe("Choose a category.");
  });
});

describe("toggleId", () => {
  it("adds an id that isn't present", () => {
    expect(toggleId([], "a")).toEqual(["a"]);
  });

  it("removes an id that is present", () => {
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });
});
