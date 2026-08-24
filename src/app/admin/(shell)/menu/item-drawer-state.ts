// Pure state for the item editor drawer's routine fields (CAP-4). Everything
// else the drawer touches - variants, modifier-group/allergen attachment,
// availability, prices - is its own immediate API call against the real
// backend contract (see item-drawer.tsx), not a batched local draft, because
// that's how restiq-backend actually exposes them (PUT replace-set for
// modifier groups/allergens, POST/DELETE per variant, its own price endpoint).

import { ItemView } from "./menu-state";

export interface ItemDraft {
  name: string;
  shortName: string;
  categoryId: string;
}

export function itemDraftFromView(item: ItemView | null, defaultCategoryId: string): ItemDraft {
  if (!item) return { name: "", shortName: "", categoryId: defaultCategoryId };
  return { name: item.name, shortName: item.shortName, categoryId: item.categoryId };
}

export interface ItemDraftErrors {
  name?: string;
  shortName?: string;
  category?: string;
}

export function validateItemDraft(draft: ItemDraft): ItemDraftErrors {
  const errors: ItemDraftErrors = {};
  if (!draft.name.trim()) errors.name = "Name the item.";
  if (!draft.shortName.trim()) errors.shortName = "Add a kitchen ticket name.";
  if (!draft.categoryId) errors.category = "Choose a category.";
  return errors;
}

export function itemDraftIsValid(draft: ItemDraft): boolean {
  return Object.keys(validateItemDraft(draft)).length === 0;
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}
