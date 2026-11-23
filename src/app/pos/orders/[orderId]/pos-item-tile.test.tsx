import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PosMenuItemView } from "./order-taking-state";
import { PosItemTile } from "./pos-item-tile";

const ITEM: PosMenuItemView = { id: "i1", categoryId: "c1", name: "Paneer Tikka", shortName: "Paneer", available: true, priceMinor: 32000, variants: [], modifierGroups: [] };

describe("PosItemTile veg marker", () => {
  afterEach(cleanup);

  it("shows the marker for a veg and a non-veg dish", () => {
    const { rerender } = render(<PosItemTile item={{ ...ITEM, vegMarker: "veg" }} currency="INR" onTap={() => undefined} />);
    expect(screen.getByTestId("item-tile-veg-i1").getAttribute("aria-label")).toBe("Vegetarian");
    rerender(<PosItemTile item={{ ...ITEM, vegMarker: "non_veg" }} currency="INR" onTap={() => undefined} />);
    expect(screen.getByTestId("item-tile-veg-i1").getAttribute("aria-label")).toBe("Non-vegetarian");
  });

  it("shows nothing when the dish has no marker, and never a description", () => {
    render(<PosItemTile item={{ ...ITEM, vegMarker: null }} currency="INR" onTap={() => undefined} />);
    expect(screen.queryByTestId("item-tile-veg-i1")).toBeNull();
  });
});
