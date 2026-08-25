// Pure P3/P4 (CAP-3) order-taking logic, kept free of React so modifier-group
// min/max validation, price math, and grid filtering are unit-testable
// without a DOM - mirrors table-map-state.ts's/shift-state.ts's split between
// logic and UI.
//
// SELF-AUTHORED CONTRACT, not yet verified against a real backend.
// restiq-backend#52 ("Order taking with modifiers, variants, combos", branch
// feature/52-order-taking-modifiers) has no branch and no commits as of this
// build - confirmed via `gh issue view 52 --repo AusPosRest/restiq-backend`
// (open, unstarted) and `gh api repos/AusPosRest/restiq-backend/branches`
// (only dev/main/feature-15 exist), plus reading the real `dev` branch's
// schema directly (`gh api .../contents/prisma/schema.prisma?ref=dev`):
// `Order` is exactly stories.yaml story 3's "base fields only, no lines yet"
// - `{id, tenantId, outletId, tableId, ownerId, status: open|sent|closed,
// createdAt, updatedAt}`, no OrderLine model anywhere, and
// `PosOrdersController` (`src/pos/orders/orders.controller.ts`) only exposes
// table-map/get/status/transfer - no `/lines` endpoint, no menu read. (The
// local `restiq-backend` working tree on disk was 6 commits behind this
// `dev` HEAD when checked - i.e. missing the entire `src/pos` module on disk
// - so this was verified against the real GitHub `dev` tree via `gh api`,
// not the stale local checkout.)
//
// The menu catalogue itself (MenuItem/ItemVariant/ModifierGroup/Modifier/
// ItemModifierGroup) is real and merged (restiq-backend's CAP-4,
// `src/admin/menu/*.dtos.ts`, read directly) - the shapes below mirror those
// field names exactly (id/name/priceMinor/minSelections/maxSelections etc.),
// but the POS-facing read (`GET /pos/v1/menu`, resolving a channel/outlet
// price server-side into a single `priceMinor` per item/variant rather than
// the admin API's separate channel-scoped price lookup) doesn't exist yet.
//
// This story's `OrderView` keeps restiq-web's own already-shipped display
// shape (`tableLabel`/`ownerStaffName`/`status: occupied|needs_bill`, from
// story 3's OrderStubView and table-map-state.ts's TableOrderSummary -
// internal consistency with the rest of the already-merged POS realm)
// rather than the real bare `Order` row's `tableId`/`ownerId`/`open|sent|
// closed` - the real base Order has no display names to read at all (those
// come from a *separate* table-map/staff lookup), so a real CAP-3 `GET
// /pos/v1/orders/:id` will need to resolve and enrich them the same way this
// self-authored one already does, not hand the client raw ids. Also note for
// whoever reconciles this: story 3's own already-shipped OrderStubView/
// TableMapEntry status vocabulary (`occupied`/`needs_bill`) doesn't match
// the real `Order.status` enum (`open`/`sent`/`closed`) either - a
// pre-existing CAP-2 gap, out of this story's scope to fix, flagged here
// only because it was noticed while reading the real schema for this story's
// own work.
//
// MUST be reconciled against the real restiq-backend#52 DTOs once that lands
// - same discipline as table-map-state.ts's CAP-2 reconciliation note and
// wiki/features/tenant-admin.md's CAP-8 dashboard reconciliation.
//
// Combos (also named in stories.yaml story 4's title) are deliberately out
// of scope for this pass - nothing in the task's own build list or test plan
// calls for them, and CreateComboDto/ComboComponent's shape is a
// meaningfully different concept (a bundle of items, not a single line) that
// would double this file's surface for no asked-for behavior (YAGNI). See
// wiki/features/pos-cashier-waiter.md's CAP-3 section for the explicit gap.
//
// DESIGN.md's POSItemTile spec calls for a "veg/non-veg dot" - the real
// MenuItem model has no such field (only free-form tenant-defined
// Allergen tags, not a dietary-type enum), so it is omitted here rather than
// guessed at from an allergen tag's name - the same no-fake-data discipline
// the owner dashboard and table-map's `needs_bill` status already follow.
//
// --- CAP-4 group ordering (story 5, issue #52 web / #58 backend) additions
// below. restiq-backend#58 ("Group ordering - seats and covers", branch
// feature/58-group-ordering) has no branch yet as of this build (`gh api
// repos/AusPosRest/restiq-backend/branches` lists only dev/main/feature-15;
// `gh issue view 58` confirms open/unstarted) - a parallel agent is building
// it. What *is* real and verified directly off restiq-backend's `dev`
// (`orders.controller.ts`/`orders.service.ts`/`orders.dtos.ts`, read via `gh
// api .../contents/...?ref=dev`, PR #57 merged): `PATCH
// /pos/v1/orders/:orderId/status {status}` (forward-only open->sent->closed,
// owner-only) already exists and already accepts `status: 'sent'` - CAP-4's
// job is only to add the seat-gate (a 400 when any line lacks a seat) on top
// of that already-real transition, not a new endpoint. Likewise `PATCH
// /pos/v1/orders/:orderId/lines/:lineId` is real (`UpdateOrderLineDto`
// today only carries `quantity`/`modifierIds`) - issue #58's own framing
// ("extends story 4's real, merged line add/edit endpoints with an optional
// seatNumber field") is taken at face value: `seatNumber` rides the same
// endpoint, not a new one. `seatNumber`/`firedAt` below are this client's
// anticipated shape for that still-unbuilt extension; reconcile once #58
// lands.
//
// `firedAt` (not a reuse of `OrderView.status`) is a deliberate new field
// rather than extending the existing `status: "occupied" | "needs_bill"`
// union - that union already mirrors table-map semantics, not the real
// `Order.status` enum (a pre-existing, out-of-scope CAP-2/CAP-3 gap flagged
// in this file's original header above). Piling CAP-4's "sent to kitchen"
// concept onto that same mismatched field would compound the gap instead of
// isolating this story's own addition - `firedAt` follows the same
// insert-only ISO-string convention already used for `openedAt`/`createdAt`
// elsewhere in this file.

export interface PosMenuVariantView {
  id: string;
  name: string;
  priceMinor: number;
}

export interface PosModifierView {
  id: string;
  name: string;
  priceMinor: number;
}

export interface PosModifierGroupView {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: PosModifierView[];
}

export interface PosMenuItemView {
  id: string;
  categoryId: string;
  name: string;
  shortName: string;
  available: boolean;
  /** Base price in minor units when the item has no variants; null when priced per-variant (see `variants`). */
  priceMinor: number | null;
  variants: PosMenuVariantView[];
  modifierGroups: PosModifierGroupView[];
}

export interface PosMenuCategoryView {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PosMenuView {
  categories: PosMenuCategoryView[];
  items: PosMenuItemView[];
  currency: string;
}

export interface OrderLineModifierView {
  modifierId: string;
  name: string;
  priceMinor: number;
}

export interface OrderLineView {
  id: string;
  itemId: string;
  itemName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  modifiers: OrderLineModifierView[];
  lineTotalMinor: number;
  specialInstructions: string | null;
  addedByStaffId: string;
  addedByStaffName: string;
  addedAt: string;
  /**
   * CAP-4 group ordering: which seat/cover this line belongs to; `null`/
   * absent means unseated. Optional (not just nullable) so story 4's
   * already-shipped call sites and tests, which never set this field, keep
   * type-checking unchanged - see this file's CAP-4 header note above.
   */
  seatNumber?: number | null;
}

export interface OrderView {
  id: string;
  tableId: string;
  tableLabel: string;
  status: "occupied" | "needs_bill";
  ownerStaffId: string;
  ownerStaffName: string;
  openedAt: string;
  currency: string;
  lines: OrderLineView[];
  /** Sum of every line's total. Tax breakdown is CAP-7 Bill & Settle's job, not this screen's - no rate is fabricated here. */
  totalMinor: number;
  /** CAP-4: set once the order has been sent to the kitchen; `null`/absent beforehand. Optional for the same story-4-compatibility reason as `OrderLineView.seatNumber` above. */
  firedAt?: string | null;
}

export interface AddOrderLineInput {
  itemId: string;
  variantId?: string;
  quantity: number;
  modifierIds: string[];
  specialInstructions?: string;
}

// --- Money formatting. AD-4 (app/pos may not import from app/admin/app/ops)
// means this can't reuse admin's menu-state.ts#formatPriceMinor even though
// the shape is identical - the pos realm's own small copy, same convention
// already established by shift-state.ts#formatMinor.

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹" };

/** Menu/order prices render whole-currency-unit, no decimals - matches the P3/P4 mocks (₹340, not ₹340.00). */
export function formatPriceMinor(priceMinor: number, currency = "INR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(priceMinor / 100).toFixed(0)}`;
}

// --- Grid filtering (category tabs + search). A non-empty search query
// searches across every category (the mock's search bar sits above the
// category rail, not scoped to the active tab); an empty query falls back to
// the active category tab.

export function filterMenuItems(items: readonly PosMenuItemView[], categoryId: string | null, query: string): PosMenuItemView[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed !== "") {
    return items.filter((item) => item.name.toLowerCase().includes(trimmed) || item.shortName.toLowerCase().includes(trimmed));
  }
  return categoryId === null ? items.slice() : items.filter((item) => item.categoryId === categoryId);
}

// --- Modifier-group selection. `ModifierSelection` maps groupId -> the
// selected modifier ids in that group. A group with maxSelections <= 1 is
// single-select (choosing a new chip replaces the old one, radio-style); a
// group with maxSelections > 1 is a capped multi-select (chips beyond the
// cap can't be added, but any selected chip can always be removed).

export type ModifierSelection = Record<string, string[]>;

export function emptyModifierSelection(item: Pick<PosMenuItemView, "modifierGroups">): ModifierSelection {
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

/** EXPERIENCE.md's badge copy: "Choose 1", "Choose up to 3". */
export function modifierGroupBadgeLabel(group: Pick<PosModifierGroupView, "minSelections" | "maxSelections">): string {
  const { minSelections: min, maxSelections: max } = group;
  if (min <= 0) return max > 0 ? `Optional · up to ${max}` : "Optional";
  if (min === max) return `Required · choose ${min}`;
  return `Required · choose ${min}-${max}`;
}

export function isGroupSatisfied(group: Pick<PosModifierGroupView, "minSelections" | "maxSelections">, selected: readonly string[]): boolean {
  return selected.length >= group.minSelections && selected.length <= group.maxSelections;
}

export function variantSatisfied(item: Pick<PosMenuItemView, "variants">, variantId: string | null): boolean {
  return item.variants.length === 0 || variantId !== null;
}

/**
 * An item with no variant to pick and no modifier group to configure has
 * nothing for P4 to mediate - tapping it adds one straight to the order, per
 * the task's own framing ("adding an item with no required modifiers works
 * directly"). Anything with a variant or a modifier group (required or not -
 * even a purely optional one still needs the sheet's chip UI to pick from)
 * routes through the ModifierSheet.
 */
export function itemNeedsModifierSheet(item: Pick<PosMenuItemView, "variants" | "modifierGroups">): boolean {
  return item.variants.length > 0 || item.modifierGroups.length > 0;
}

/** Gates the ModifierSheet's confirm button - disabled, never hidden, per EXPERIENCE.md. */
export function canConfirmSelection(
  item: Pick<PosMenuItemView, "variants" | "modifierGroups">,
  selection: ModifierSelection,
  variantId: string | null,
): boolean {
  if (!variantSatisfied(item, variantId)) return false;
  return item.modifierGroups.every((group) => isGroupSatisfied(group, selection[group.id] ?? []));
}

// --- Price resolution for the sheet's live running price and the line
// eventually posted to the order.

export function resolveUnitPriceMinor(item: Pick<PosMenuItemView, "priceMinor" | "variants">, variantId: string | null): number {
  if (item.variants.length > 0) {
    return item.variants.find((variant) => variant.id === variantId)?.priceMinor ?? 0;
  }
  return item.priceMinor ?? 0;
}

export function resolveSelectedModifiers(item: Pick<PosMenuItemView, "modifierGroups">, selection: ModifierSelection): PosModifierView[] {
  const modifiers: PosModifierView[] = [];
  for (const group of item.modifierGroups) {
    const selectedIds = selection[group.id] ?? [];
    for (const modifier of group.modifiers) {
      if (selectedIds.includes(modifier.id)) modifiers.push(modifier);
    }
  }
  return modifiers;
}

export function computeUnitTotalMinor(unitPriceMinor: number, modifiers: readonly PosModifierView[]): number {
  return unitPriceMinor + modifiers.reduce((sum, modifier) => sum + modifier.priceMinor, 0);
}

export function computeOrderTotalMinor(lines: readonly OrderLineView[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
}

// --- CAP-4 group ordering: seat assignment and the fire-gate. SPEC.md's
// success criterion is literal: "Every item is assigned to a seat number
// before the order can be sent to the kitchen; unassigned items block
// fire." `allLinesSeated`/`canSendToKitchen` are this client's mirror of
// that server-side gate (see this file's CAP-4 header note for why the real
// 400 doesn't exist to verify against yet).

/** Vacuously true for an order with no lines - nothing to block yet. */
export function allLinesSeated(lines: readonly OrderLineView[]): boolean {
  return lines.every((line) => line.seatNumber != null);
}

export function unseatedLineCount(lines: readonly OrderLineView[]): number {
  return lines.filter((line) => line.seatNumber == null).length;
}

/** Gates the "Send to kitchen" action - disabled, never hidden, same EXPERIENCE.md convention as ModifierSheet's confirm button. */
export function canSendToKitchen(order: Pick<OrderView, "lines" | "firedAt">): boolean {
  return order.lines.length > 0 && !order.firedAt && allLinesSeated(order.lines);
}
