// Pure CAP-2 (Menu Browse Q3 / Item Detail Q4) logic - category/item
// filtering, price resolution, and variant/modifier selection + min/max
// validation - kept free of React so the min/max gating (SPEC's "a modifier
// selection violating min/max cannot be added, same server-side rule as
// POS CAP-3") is unit-testable without a DOM. This mirrors pos/orders/
// [orderId]/order-taking-state.ts's ModifierSheet logic (identical rule) as
// a fresh, small copy rather than a shared import - AD-4 forbids app/qr
// importing from app/pos, and the two realms' menu DTOs aren't identical
// (see below), so a shared abstraction would cost more than it saves.
//
// Types mirror the real, merged backend contract field-for-field
// (restiq-backend `dev`, `src/guest/menu/menu.dtos.ts` + `cart.dtos.ts`,
// read directly via `gh api`/raw.githubusercontent.com - PR #73/#74).
// Notably: `GuestMenuView` has NO top-level currency (unlike the POS
// realm's `PosMenuView`) - every item/variant carries its own nullable
// `currency`, so price display always resolves currency per-item, never
// assumed globally.
//
// KNOWN SCHEMA GAP - be honest, don't fabricate (spec-qr-self-order's own
// framing, echoed in wiki/features/qr-self-order.md): the real
// `MenuItemView` has no photo, no bilingual (Hindi) name, and no veg/
// non-veg field, and the mocks (Q3/Q4) show all three plus a star rating
// and a "bestseller" badge that also don't exist in the data. This client
// renders an initial-letter tile instead of a photo and omits the veg
// marker, Hindi name, rating, and bestseller badge entirely rather than
// inventing any of them.

export interface MenuModifierView {
  id: string;
  name: string;
  priceMinor: number;
}

export interface MenuModifierGroupView {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: MenuModifierView[];
}

export interface MenuAllergenView {
  id: string;
  name: string;
}

export interface MenuVariantView {
  id: string;
  name: string;
  sortOrder: number;
  priceMinor: number | null;
  currency: string | null;
}

export interface MenuItemView {
  id: string;
  categoryId: string;
  name: string;
  shortName: string;
  available: boolean;
  priceMinor: number | null;
  currency: string | null;
  variants: MenuVariantView[];
  modifierGroups: MenuModifierGroupView[];
  allergens: MenuAllergenView[];
}

export interface MenuCategoryView {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemView[];
}

export interface GuestMenuView {
  outletId: string;
  categories: MenuCategoryView[];
}

export interface PriceDisplay {
  priceMinor: number;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹" };

/** Menu/cart prices render whole-currency-unit, no decimals - matches the Q3/Q4 mocks (₹340, not ₹340.00). */
export function formatPriceMinor(priceMinor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(priceMinor / 100).toFixed(0)}`;
}

/** EXPERIENCE.md State Patterns: "an empty menu category is skipped, not shown hollow." */
export function nonEmptyCategories(categories: readonly MenuCategoryView[]): MenuCategoryView[] {
  return categories.filter((category) => category.items.length > 0);
}

/**
 * The card's display price: the base price for an item priced directly, or
 * the cheapest currently-priced variant when priced per-variant (AD-11: an
 * item's own price and its variants' prices never mix). `null` when nothing
 * is priced yet - never invented as 0.
 */
export function displayPriceInfo(item: Pick<MenuItemView, "priceMinor" | "currency" | "variants">): PriceDisplay | null {
  if (item.variants.length > 0) {
    const priced = item.variants
      .filter((variant) => variant.priceMinor !== null && variant.currency !== null)
      .map((variant) => ({ priceMinor: variant.priceMinor as number, currency: variant.currency as string }));
    if (priced.length === 0) return null;
    return priced.reduce((cheapest, price) => (price.priceMinor < cheapest.priceMinor ? price : cheapest));
  }
  if (item.priceMinor === null || item.currency === null) return null;
  return { priceMinor: item.priceMinor, currency: item.currency };
}

/**
 * Items visible for the current view. A non-empty search query searches
 * every category by name/short name (EXPERIENCE.md: the search bar isn't
 * scoped to the active tab); an empty query falls back to the active
 * category.
 */
export function visibleItems(categories: readonly MenuCategoryView[], activeCategoryId: string | null, query: string): MenuItemView[] {
  const all = categories.flatMap((category) => category.items);
  const trimmed = query.trim().toLowerCase();
  if (trimmed !== "") {
    return all.filter((item) => item.name.toLowerCase().includes(trimmed) || item.shortName.toLowerCase().includes(trimmed));
  }
  return activeCategoryId === null ? all : all.filter((item) => item.categoryId === activeCategoryId);
}

/** The initial-letter placeholder tile standing in for a photo (see this file's header note on the schema gap). */
export function initialLetterTile(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

// --- Item Detail (Q4): variant/modifier selection, same min/max discipline
// as POS's ModifierSheet / restiq-backend's assertModifierSelectionValid
// (src/guest/cart/cart.service.ts, read directly - identical rule).

export type ModifierSelection = Record<string, string[]>;

export function emptyModifierSelection(item: Pick<MenuItemView, "modifierGroups">): ModifierSelection {
  const selection: ModifierSelection = {};
  for (const group of item.modifierGroups) selection[group.id] = [];
  return selection;
}

export function toggleModifier(selected: readonly string[], modifierId: string, maxSelections: number): string[] {
  if (selected.includes(modifierId)) return selected.filter((id) => id !== modifierId);
  if (maxSelections <= 1) return [modifierId];
  if (selected.length >= maxSelections) return selected.slice();
  return [...selected, modifierId];
}

/** EXPERIENCE.md's badge copy, same convention as POS's ModifierSheet: "Choose 1", "Choose up to 3". */
export function modifierGroupBadgeLabel(group: Pick<MenuModifierGroupView, "minSelections" | "maxSelections">): string {
  const { minSelections: min, maxSelections: max } = group;
  if (min <= 0) return max > 0 ? `Optional · up to ${max}` : "Optional";
  if (min === max) return `Required · choose ${min}`;
  return `Required · choose ${min}-${max}`;
}

export function isGroupSatisfied(group: Pick<MenuModifierGroupView, "minSelections" | "maxSelections">, selected: readonly string[]): boolean {
  return selected.length >= group.minSelections && selected.length <= group.maxSelections;
}

/**
 * Gates the sticky bottom bar's "Add to Cart" - disabled, never hidden,
 * per EXPERIENCE.md's Component Patterns ("confirm disabled-not-hidden
 * until satisfied, the same server-side rule backs it"). An unavailable
 * item can never be added regardless of selection (SPEC CAP-2 success
 * criterion).
 */
export function canAddToCart(item: Pick<MenuItemView, "available" | "variants" | "modifierGroups">, selection: ModifierSelection, variantId: string | null): boolean {
  if (!item.available) return false;
  if (item.variants.length > 0 && variantId === null) return false;
  return item.modifierGroups.every((group) => isGroupSatisfied(group, selection[group.id] ?? []));
}

/** The selected variant's (or the item's own) price; `null` when unselected/unpriced - never invented. */
export function resolveUnitPriceMinor(item: Pick<MenuItemView, "priceMinor" | "currency" | "variants">, variantId: string | null): PriceDisplay | null {
  if (item.variants.length > 0) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (!variant || variant.priceMinor === null || variant.currency === null) return null;
    return { priceMinor: variant.priceMinor, currency: variant.currency };
  }
  if (item.priceMinor === null || item.currency === null) return null;
  return { priceMinor: item.priceMinor, currency: item.currency };
}

export function resolveSelectedModifiers(item: Pick<MenuItemView, "modifierGroups">, selection: ModifierSelection): MenuModifierView[] {
  const modifiers: MenuModifierView[] = [];
  for (const group of item.modifierGroups) {
    const selectedIds = selection[group.id] ?? [];
    for (const modifier of group.modifiers) {
      if (selectedIds.includes(modifier.id)) modifiers.push(modifier);
    }
  }
  return modifiers;
}

export function computeUnitTotalMinor(unitPriceMinor: number, modifiers: readonly MenuModifierView[]): number {
  return unitPriceMinor + modifiers.reduce((sum, modifier) => sum + modifier.priceMinor, 0);
}
