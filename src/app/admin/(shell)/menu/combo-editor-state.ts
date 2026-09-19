// Combo editor form state (restiq-web#264). Pure so the rules are unit
// tested; the editor component only renders and calls these.
import type { SaveComboInput } from "../../api";
import { majorStringToPriceMinor, type ComboView } from "./menu-state";

export interface OptionDraft {
  itemId: string;
  variantId: string | null;
  upcharge: string;
}

export interface SlotDraft {
  key: string;
  name: string;
  pickCount: string;
  options: OptionDraft[];
}

export interface ComboDraft {
  name: string;
  categoryId: string;
  price: string;
  available: boolean;
  slots: SlotDraft[];
}

export type ComboDraftErrors = Partial<Record<"name" | "price" | "category" | "slots", string>> & { slotErrors?: Record<string, string> };

let keySeq = 0;
export const newSlotKey = () => `slot-${++keySeq}`;

const toMajor = (minor: number) => (minor / 100).toString();

export function emptySlot(): SlotDraft {
  return { key: newSlotKey(), name: "", pickCount: "1", options: [] };
}

export function draftFromCombo(combo: ComboView | null, defaultCategoryId: string): ComboDraft {
  if (!combo) return { name: "", categoryId: defaultCategoryId, price: "", available: true, slots: [emptySlot()] };
  return {
    name: combo.name,
    categoryId: combo.categoryId ?? "",
    price: toMajor(combo.priceMinor),
    available: combo.available,
    slots: combo.slots.map((slot) => ({
      key: newSlotKey(),
      name: slot.name,
      pickCount: String(slot.pickCount),
      options: slot.options.map((o) => ({ itemId: o.itemId, variantId: o.variantId, upcharge: o.upchargeMinor ? toMajor(o.upchargeMinor) : "" })),
    })),
  };
}

export function validateComboDraft(draft: ComboDraft): ComboDraftErrors {
  const errors: ComboDraftErrors = {};
  if (!draft.name.trim()) errors.name = "Enter a name";
  if (majorStringToPriceMinor(draft.price) === null) errors.price = "Enter a price";
  // A combo shows on the POS, QR and kiosk menus under its category.
  if (!draft.categoryId) errors.category = "Pick where it shows";
  if (draft.slots.length === 0) errors.slots = "Add at least one slot";
  const slotErrors: Record<string, string> = {};
  for (const slot of draft.slots) {
    const pick = Number(slot.pickCount);
    if (!slot.name.trim()) slotErrors[slot.key] = "Name this slot";
    else if (!Number.isInteger(pick) || pick < 1) slotErrors[slot.key] = "Pick at least 1";
    else if (slot.options.length === 0) slotErrors[slot.key] = "Add at least one item";
    else if (slot.options.some((o) => o.upcharge.trim() !== "" && majorStringToPriceMinor(o.upcharge) === null)) slotErrors[slot.key] = "Extra charges must be amounts";
  }
  if (Object.keys(slotErrors).length > 0) errors.slotErrors = slotErrors;
  return errors;
}

export function toSaveComboInput(draft: ComboDraft, currency: string): SaveComboInput {
  return {
    name: draft.name.trim(),
    ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
    priceMinor: majorStringToPriceMinor(draft.price) ?? 0,
    currency,
    available: draft.available,
    slots: draft.slots.map((slot) => ({
      name: slot.name.trim(),
      pickCount: Number(slot.pickCount),
      options: slot.options.map((o) => ({
        itemId: o.itemId,
        ...(o.variantId ? { variantId: o.variantId } : {}),
        upchargeMinor: o.upcharge.trim() ? (majorStringToPriceMinor(o.upcharge) ?? 0) : 0,
      })),
    })),
  };
}

/** "Main: pick 1 of 3 · Dessert: Gulab jamun" - one line for the combo list. */
export function describeSlots(combo: ComboView): string {
  return combo.slots
    .map((s) => (s.options.length === 1 ? `${s.name}: ${s.pickCount > 1 ? `${s.pickCount}× ` : ""}${s.options[0].itemName}` : `${s.name}: pick ${s.pickCount} of ${s.options.length}`))
    .join(" · ");
}
