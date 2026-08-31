import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModifierSheet } from "./modifier-sheet";
import type { PosMenuItemView } from "./order-taking-state";

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
  modifierGroups: [
    {
      id: "g-spice",
      name: "Spice Level",
      minSelections: 1,
      maxSelections: 1,
      modifiers: [
        { id: "m-mild", name: "Mild", priceMinor: 0 },
        { id: "m-medium", name: "Medium", priceMinor: 0 },
        { id: "m-spicy", name: "Spicy", priceMinor: 0 },
      ],
    },
    {
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
    },
  ],
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

afterEach(() => cleanup());

describe("ModifierSheet", () => {
  it("renders the required/optional badges from min/max", () => {
    render(<ModifierSheet item={PANEER_TIKKA} currency="INR" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("modifier-group-badge-g-spice").textContent).toBe("Required · choose 1");
    expect(screen.getByTestId("modifier-group-badge-g-addons").textContent).toBe("Optional · up to 3");
  });

  it("blocks confirm until the required modifier group and a variant are both chosen", async () => {
    const user = userEvent.setup();
    render(<ModifierSheet item={PANEER_TIKKA} currency="INR" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    const confirm = screen.getByTestId("modifier-sheet-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await user.click(screen.getByTestId("variant-chip-v-half"));
    expect(confirm.disabled).toBe(true); // variant chosen, required spice group still unsatisfied

    await user.click(screen.getByTestId("modifier-chip-m-medium"));
    expect(confirm.disabled).toBe(false);
  });

  it("an item with no variants and no modifier groups can be confirmed immediately", () => {
    render(<ModifierSheet item={BUTTER_NAAN} currency="INR" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect((screen.getByTestId("modifier-sheet-confirm") as HTMLButtonElement).disabled).toBe(false);
  });

  it("single-select groups swap the selection instead of accumulating", async () => {
    const user = userEvent.setup();
    render(<ModifierSheet item={PANEER_TIKKA} currency="INR" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    await user.click(screen.getByTestId("modifier-chip-m-mild"));
    expect(screen.getByTestId("modifier-chip-m-mild").getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByTestId("modifier-chip-m-medium"));
    expect(screen.getByTestId("modifier-chip-m-mild").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("modifier-chip-m-medium").getAttribute("aria-pressed")).toBe("true");
  });

  it("multi-select groups refuse a chip past the max", async () => {
    const user = userEvent.setup();
    render(<ModifierSheet item={PANEER_TIKKA} currency="INR" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    await user.click(screen.getByTestId("modifier-chip-m-chutney"));
    await user.click(screen.getByTestId("modifier-chip-m-onion"));
    await user.click(screen.getByTestId("modifier-chip-m-butter"));
    await user.click(screen.getByTestId("modifier-chip-m-cheese"));

    expect(screen.getByTestId("modifier-chip-m-cheese").getAttribute("aria-pressed")).toBe("false");
  });

  it("reports the chosen variant, modifiers, quantity, and instructions on confirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ModifierSheet item={PANEER_TIKKA} currency="INR" onCancel={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByTestId("variant-chip-v-full"));
    await user.click(screen.getByTestId("modifier-chip-m-spicy"));
    await user.click(screen.getByTestId("modifier-sheet-qty-increment"));
    await user.type(screen.getByTestId("modifier-sheet-instructions"), "less oil");
    await user.click(screen.getByTestId("modifier-sheet-confirm"));

    expect(onConfirm).toHaveBeenCalledWith({
      variantId: "v-full",
      modifierIds: ["m-spicy"],
      quantity: 2,
      specialInstructions: "less oil",
    });
  });

  it("cancel calls onCancel without confirming", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ModifierSheet item={BUTTER_NAAN} currency="INR" onCancel={onCancel} onConfirm={onConfirm} />);

    await user.click(screen.getByTestId("modifier-sheet-cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
