import { describe, expect, it } from "vitest";
import type { AllDaySummaryEntryView } from "../../api";
import { sortHighestCountFirst } from "./all-day-summary-state";

function entry(overrides: Partial<AllDaySummaryEntryView>): AllDaySummaryEntryView {
  return { itemId: "i1", itemName: "Tandoori Roti", quantity: 1, ...overrides };
}

describe("sortHighestCountFirst", () => {
  it("orders entries by quantity descending", () => {
    const entries = [entry({ itemId: "a", quantity: 2 }), entry({ itemId: "b", quantity: 9 }), entry({ itemId: "c", quantity: 5 })];
    expect(sortHighestCountFirst(entries).map((e) => e.itemId)).toEqual(["b", "c", "a"]);
  });

  it("keeps the backend's alphabetical order stable between tied counts", () => {
    const entries = [entry({ itemId: "a", itemName: "Garlic Naan", quantity: 3 }), entry({ itemId: "b", itemName: "Paneer Tikka", quantity: 3 })];
    expect(sortHighestCountFirst(entries).map((e) => e.itemId)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const entries = [entry({ itemId: "a", quantity: 1 }), entry({ itemId: "b", quantity: 5 })];
    sortHighestCountFirst(entries);
    expect(entries.map((e) => e.itemId)).toEqual(["a", "b"]);
  });
});
