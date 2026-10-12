// Combo picking (restiq-web#264, restiq-backend#160), shared by the POS and
// the guest QR / kiosk menu. Pure: the picker component renders these and the
// server re-checks every rule on add.

export interface ComboOptionView {
  id: string;
  itemId: string;
  itemName: string;
  variantId: string | null;
  variantName: string | null;
  upchargeMinor: number;
  available: boolean;
}

export interface ComboSlotView {
  id: string;
  name: string;
  pickCount: number;
  options: ComboOptionView[];
}

export interface ComboMenuView {
  id: string;
  categoryId: string | null;
  name: string;
  photoUrl: string | null;
  priceMinor: number;
  currency: string;
  available: boolean;
  slots: ComboSlotView[];
}

/** What the picker needs to know about an item: its prices (for savings) and its modifier groups. */
export interface ComboItemInfo {
  id: string;
  priceMinor: number | null;
  variants: ReadonlyArray<{ id: string; priceMinor: number | null }>;
  modifierGroups: ReadonlyArray<{
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    modifiers: ReadonlyArray<{ id: string; name: string; priceMinor: number }>;
  }>;
}

export interface ComboPick {
  quantity: number;
  modifierIds: string[];
}

/** optionId -> how many of it are picked, and that item's modifiers. */
export type ComboPicks = Record<string, ComboPick>;

export interface ComboSelection {
  optionId: string;
  quantity: number;
  modifierIds: string[];
}

export const isFixedSlot = (slot: ComboSlotView) => slot.options.length === 1;

/** Fixed slots start filled; everything else starts empty. */
export function initialPicks(combo: ComboMenuView): ComboPicks {
  const picks: ComboPicks = {};
  for (const slot of combo.slots) {
    if (isFixedSlot(slot)) picks[slot.options[0].id] = { quantity: slot.pickCount, modifierIds: [] };
  }
  return picks;
}

export function slotCount(slot: ComboSlotView, picks: ComboPicks): number {
  return slot.options.reduce((sum, option) => sum + (picks[option.id]?.quantity ?? 0), 0);
}

/**
 * Tapping an option. A pick-1 slot works like a radio (the new choice
 * replaces the old one); a pick-N slot adds one more, up to N. delta -1
 * takes one away.
 */
export function changePick(slot: ComboSlotView, picks: ComboPicks, optionId: string, delta: 1 | -1): ComboPicks {
  const next: ComboPicks = { ...picks };
  const current = next[optionId]?.quantity ?? 0;
  if (delta === -1) {
    if (current <= 1) delete next[optionId];
    else next[optionId] = { ...next[optionId], quantity: current - 1 };
    return next;
  }
  if (slot.pickCount === 1) {
    for (const option of slot.options) delete next[option.id];
    next[optionId] = { quantity: 1, modifierIds: picks[optionId]?.modifierIds ?? [] };
    return next;
  }
  if (slotCount(slot, picks) >= slot.pickCount) return picks;
  next[optionId] = { quantity: current + 1, modifierIds: next[optionId]?.modifierIds ?? [] };
  return next;
}

/**
 * A picked item's modifier chip, with the same rule as a single item's
 * modifier sheet: a pick-1 group swaps within itself, a pick-N group caps at N.
 */
export function toggleGroupModifier(picks: ComboPicks, optionId: string, group: ComboItemInfo["modifierGroups"][number], modifierId: string): ComboPicks {
  const pick = picks[optionId];
  if (!pick) return picks;
  const groupIds = new Set(group.modifiers.map((m) => m.id));
  const inGroup = pick.modifierIds.filter((id) => groupIds.has(id));
  const others = pick.modifierIds.filter((id) => !groupIds.has(id));
  let next: string[];
  if (inGroup.includes(modifierId)) next = inGroup.filter((id) => id !== modifierId);
  else if (group.maxSelections <= 1) next = [modifierId];
  else if (inGroup.length >= group.maxSelections) return picks;
  else next = [...inGroup, modifierId];
  return { ...picks, [optionId]: { ...pick, modifierIds: [...others, ...next] } };
}

function pickedOptions(combo: ComboMenuView, picks: ComboPicks) {
  return combo.slots.flatMap((slot) => slot.options.filter((o) => (picks[o.id]?.quantity ?? 0) > 0).map((option) => ({ slot, option, pick: picks[option.id] })));
}

/** Every slot adds up to its pick count and every picked item's modifier groups are within min/max. */
export function canAddCombo(combo: ComboMenuView, picks: ComboPicks, itemsById: ReadonlyMap<string, ComboItemInfo>): boolean {
  if (!combo.available) return false;
  if (!combo.slots.every((slot) => slotCount(slot, picks) === slot.pickCount)) return false;
  return pickedOptions(combo, picks).every(({ option, pick }) => {
    if (!option.available) return false;
    const groups = itemsById.get(option.itemId)?.modifierGroups ?? [];
    return groups.every((group) => {
      const n = group.modifiers.filter((m) => pick.modifierIds.includes(m.id)).length;
      return n >= group.minSelections && n <= group.maxSelections;
    });
  });
}

/** One combo's price: the combo price plus each pick's extra charge and paid modifiers. */
export function comboUnitPriceMinor(combo: ComboMenuView, picks: ComboPicks, itemsById: ReadonlyMap<string, ComboItemInfo>): number {
  return pickedOptions(combo, picks).reduce((sum, { option, pick }) => {
    const modifiers = (itemsById.get(option.itemId)?.modifierGroups ?? []).flatMap((g) => g.modifiers).filter((m) => pick.modifierIds.includes(m.id));
    return sum + pick.quantity * (option.upchargeMinor + modifiers.reduce((s, m) => s + m.priceMinor, 0));
  }, combo.priceMinor);
}

export function toSelections(combo: ComboMenuView, picks: ComboPicks): ComboSelection[] {
  return pickedOptions(combo, picks).map(({ option, pick }) => ({ optionId: option.id, quantity: pick.quantity, modifierIds: pick.modifierIds }));
}

/**
 * How much cheaper the combo is than buying its default picks (each slot's
 * first option) separately. 0 when it isn't cheaper or a price is unknown.
 */
export function comboSavingsMinor(combo: ComboMenuView, itemsById: ReadonlyMap<string, ComboItemInfo>): number {
  let aLaCarte = 0;
  for (const slot of combo.slots) {
    const option = slot.options[0];
    const item = option ? itemsById.get(option.itemId) : undefined;
    const price = option?.variantId ? item?.variants.find((v) => v.id === option.variantId)?.priceMinor : item?.priceMinor;
    if (price == null) return 0;
    aLaCarte += price * slot.pickCount;
  }
  return Math.max(0, aLaCarte - combo.priceMinor);
}

/** Combos that belong on a menu page: in this category, or matching the search. */
export function combosFor(combos: readonly ComboMenuView[] | undefined, categoryId: string | null, query: string): ComboMenuView[] {
  const q = query.trim().toLowerCase();
  if (q) return (combos ?? []).filter((c) => c.name.toLowerCase().includes(q));
  return (combos ?? []).filter((c) => c.categoryId === categoryId);
}
