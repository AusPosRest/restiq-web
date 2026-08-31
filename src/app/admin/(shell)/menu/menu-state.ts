// Pure Menu Management logic (CAP-4), kept free of React so it's testable on
// its own - mirrors the ops tenant directory's table-state.ts split between
// logic and UI, and menu-import-state.ts's money helper style.
//
// Types below mirror restiq-backend's actual admin/v1/menu DTOs
// (src/admin/menu/*.dtos.ts on feature/30-menu-management as read directly
// from its working tree - see the PR description for what's since been
// merged vs. still just that branch). Two backend facts shape this file:
//  - Modifier groups and allergens are tenant-wide reusable catalogs an item
//    merely references by id (PUT .../modifier-groups, PUT .../allergens) -
//    not data an item owns and edits inline.
//  - A price is per (item, variant?, channel, outlet?) - GET .../price only
//    ever resolves the CURRENT (non-future) row for one such combination;
//    there is no endpoint that lists an item's future-scheduled rows. This
//    file's PendingPriceInfo is therefore populated only from what the UI
//    itself just wrote in this session (see item-drawer.tsx), not fetched.

export type PriceChannel = "dine_in" | "takeaway" | "delivery" | "qr" | "aggregator";

export const PRICE_CHANNELS: PriceChannel[] = ["dine_in", "takeaway", "delivery", "qr", "aggregator"];

export const CHANNEL_LABEL: Record<PriceChannel, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
  qr: "QR",
  aggregator: "Aggregator",
};

/** The two channels shown as list/drawer price columns - the others remain settable through the same API, just not surfaced as their own column in v1. */
export const PRIMARY_CHANNELS: PriceChannel[] = ["dine_in", "delivery"];

export interface VariantView {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ModifierView {
  id: string;
  name: string;
  priceMinor: number;
}

export interface ModifierGroupView {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: ModifierView[];
}

export interface AllergenView {
  id: string;
  name: string;
}

export interface ItemView {
  id: string;
  categoryId: string;
  name: string;
  shortName: string;
  available: boolean;
  variants: VariantView[];
  modifierGroups: ModifierGroupView[];
  allergens: AllergenView[];
}

export interface CategoryView {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
}

export interface ComboComponentView {
  itemId: string;
  quantity: number;
}

export interface ComboView {
  id: string;
  name: string;
  categoryId: string | null;
  priceMinor: number;
  currency: string;
  components: ComboComponentView[];
}

export interface CurrentPriceView {
  itemId: string;
  variantId: string | null;
  channel: PriceChannel;
  outletId: string | null;
  priceMinor: number;
  currency: string;
  effectiveAt: string;
}

// Matches restiq-backend's actual GET /admin/v1/outlets response
// (src/admin/outlets/outlets.dtos.ts, read directly - not the { id, name,
// city } shape assumed at kickoff, since the real `outlets` table has no
// city column).
export type OutletType = "dine_in" | "qsr" | "cloud_kitchen" | "food_court";

export interface OutletView {
  id: string;
  name: string;
  address: string;
  type: OutletType;
  timezone: string;
}

/** Client-tracked only (see file header) - the price just scheduled/saved in
 * this browser session for a given (variant, channel), kept until reload. */
export interface PendingPriceInfo {
  variantId: string | null;
  channel: PriceChannel;
  priceMinor: number;
  currency: string;
  effectiveAt: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", AUD: "$", GBP: "£" };

export function formatPriceMinor(priceMinor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(priceMinor / 100).toFixed(0)}`;
}

export function majorStringToPriceMinor(value: string): number | null {
  const major = Number.parseFloat(value);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

export function formatEffectiveDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function pendingChangeFor(
  pending: readonly PendingPriceInfo[],
  variantId: string | null,
  channel: PriceChannel,
): PendingPriceInfo | null {
  return pending.find((p) => p.variantId === variantId && p.channel === channel) ?? null;
}

// --- List view: category filter + search, all client-side (the item count
// per tenant is small enough that a DataTable-style server round trip per
// keystroke would be over-engineering here - YAGNI per the workspace's
// ponytail ladder).

export const ALL_CATEGORY = "all";

export interface MenuQuery {
  category: string;
  q: string;
}

export function parseMenuQuery(params: URLSearchParams): MenuQuery {
  return { category: params.get("category") ?? ALL_CATEGORY, q: params.get("q") ?? "" };
}

export function toMenuUrlParams(query: MenuQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.category && query.category !== ALL_CATEGORY) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  return params;
}

function matchesSearch(item: ItemView, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  return [item.name, item.shortName].some((field) => field.toLowerCase().includes(needle));
}

export function visibleItems(items: readonly ItemView[], query: MenuQuery): ItemView[] {
  return items.filter((item) => (query.category === ALL_CATEGORY || item.categoryId === query.category) && matchesSearch(item, query.q));
}

// --- Modifier group validation. Rules mirror standard POS modifier
// semantics and the backend's own structural checks (min <= max, min >= 0):
// a group needs a name, a non-negative minimum, a maximum of at least 1 that
// isn't below the minimum, and (client-side extra, for a sane UI even though
// the backend doesn't enforce this one) a maximum that can't exceed the
// number of modifiers actually offered.

export interface ModifierGroupErrors {
  name?: string;
  min?: string;
  max?: string;
  options?: string;
}

export function validateModifierGroup(
  group: Pick<ModifierGroupView, "name" | "minSelections" | "maxSelections" | "modifiers">,
): ModifierGroupErrors {
  const errors: ModifierGroupErrors = {};
  if (!group.name.trim()) errors.name = "Name this modifier group.";
  if (group.modifiers.length === 0) errors.options = "Add at least one option.";
  if (group.minSelections < 0) errors.min = "Minimum can't be negative.";
  if (group.maxSelections < 1) errors.max = "Maximum must be at least 1.";
  else if (group.maxSelections < group.minSelections) errors.max = "Maximum can't be less than minimum.";
  else if (group.modifiers.length > 0 && group.maxSelections > group.modifiers.length) {
    errors.max = `Maximum can't exceed the number of options (${group.modifiers.length}).`;
  }
  return errors;
}

export function modifierGroupIsValid(group: Pick<ModifierGroupView, "name" | "minSelections" | "maxSelections" | "modifiers">): boolean {
  return Object.keys(validateModifierGroup(group)).length === 0;
}

export function combosForItem(combos: readonly ComboView[], itemId: string): ComboView[] {
  return combos.filter((combo) => combo.components.some((component) => component.itemId === itemId));
}
