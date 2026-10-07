import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComboItemInfo, ComboMenuView } from "@/lib/combo";
import { ComboPicker } from "./combo-picker";

afterEach(cleanup);

const opt = (id: string, itemName: string, upchargeMinor = 0) => ({ id, itemId: `i-${id}`, itemName, variantId: null, variantName: null, upchargeMinor, available: true });
const combo: ComboMenuView = {
  id: "thali",
  categoryId: "mains",
  name: "Thali Meal",
  photoUrl: null,
  priceMinor: 34900,
  currency: "INR",
  available: true,
  slots: [
    { id: "main", name: "Main", pickCount: 1, options: [opt("bc", "Butter chicken"), opt("pt", "Paneer tikka")] },
    { id: "bread", name: "Bread", pickCount: 2, options: [opt("gn", "Garlic naan")] },
    { id: "drink", name: "Drink", pickCount: 1, options: [opt("ml", "Mango lassi", 3000), opt("ch", "Chai")] },
  ],
};
const items = new Map<string, ComboItemInfo>();
const rupees = (minor: number) => `₹${minor / 100}`;

describe("ComboPicker (restiq-web#264)", () => {
  it("shows fixed slots as included, keeps Add disabled until every slot is chosen, then sends the picks", () => {
    const onConfirm = vi.fn();
    render(<ComboPicker combo={combo} itemsById={items} formatPrice={rupees} themeClass="pos-theme" busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByTestId("combo-picker-slot-bread").textContent).toContain("Included: 2× Garlic naan");
    const add = screen.getByTestId("combo-picker-confirm");
    expect(add).toHaveProperty("disabled", true);
    expect(add.textContent).toBe("Choose every item");

    fireEvent.click(screen.getByTestId("combo-option-pt"));
    fireEvent.click(screen.getByTestId("combo-option-ml"));
    fireEvent.click(screen.getByTestId("combo-picker-qty-increment"));
    expect(add).toHaveProperty("disabled", false);
    expect(add.textContent).toBe("Add to order · ₹758"); // (349 + 30) x 2

    fireEvent.click(add);
    expect(onConfirm).toHaveBeenCalledWith({
      quantity: 2,
      selections: [
        { optionId: "pt", quantity: 1, modifierIds: [] },
        { optionId: "gn", quantity: 2, modifierIds: [] },
        { optionId: "ml", quantity: 1, modifierIds: [] },
      ],
    });
  });
});
