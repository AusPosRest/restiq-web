// Pure P3/P4 (CAP-3) order-taking logic, kept free of React so modifier-group
// min/max validation, price math, and grid filtering are unit-testable
// without a DOM - mirrors table-map-state.ts's/shift-state.ts's split between
// logic and UI.
//
// The menu catalogue types below (PosMenuItemView/PosMenuCategoryView/
// PosModifierGroupView/PosModifierView/PosMenuVariantView/PosMenuView) were
// never wrong - they already matched the real, now-shipped
// `GET /pos/v1/menu` (restiq-backend's `src/pos/menu/menu.dtos.ts`'s
// `MenuView`, read directly) from the day this file was first built. No
// change needed there.
//
// RECONCILED (2026-08-27, restiq-web#61) against the real, merged
// restiq-backend `dev` contract for `Order`/`OrderLine`
// (src/pos/orders/orders.dtos.ts's `OrderView`/`OrderLineView`, read
// directly - restiq-backend#52/#58 have since landed). What the original
// self-authored guess got wrong, all fixed here:
//  - the real `Order`/`OrderLine` carry raw ids only - `itemId`/`variantId`
//    (no `itemName`/`variantName`), `addedByStaffId` (no
//    `addedByStaffName`), `tableId`/`ownerId` (no `tableLabel`/
//    `ownerStaffName` display strings) - there is no server-side name-lookup
//    join anywhere in pos/*. `toOrderView`/`toOrderLineView` below do that
//    join client-side against the menu already loaded for this screen
//    (itemName/variantName), the same "raw id, resolved where we can, never
//    fabricated" posture open-orders-state.ts's `toOpenOrderEntry`
//    established for `ownerStaffId`/`tableLabel` - callers compare
//    `ownerStaffId`/`addedByStaffId` against the viewer's own id to show
//    "You" instead of a raw id for the viewer's own entries, same as
//    open-orders-screen.tsx's `isOwnOrder`.
//  - `lineTotalMinor` doesn't exist on the wire - it's derived here via
//    `computeUnitTotalMinor` (unchanged, reused, not re-derived - same
//    formula open-orders-state.ts's `toOpenOrderEntry` already reuses this
//    file's export for).
//  - there is no `currency` on `Order` at all - it lives on the menu
//    (`PosMenuView.currency`, resolved server-side from a single fixed
//    dine-in price channel, see menu.dtos.ts's own header). Screens read
//    `menu.currency` directly now instead of a fabricated `OrderView.currency`.
//  - `Order.status` is a real three-valued enum (`open`/`sent`/`closed`),
//    forward-only - not the old self-authored `occupied`/`needs_bill` guess
//    (that vocabulary was table-map's, mismatched even before this
//    reconciliation, see table-map-state.ts's own former header). The old
//    `firedAt` field (a fabricated timestamp nothing server-side ever sets)
//    is gone - `canSendToKitchen`/the send-to-kitchen UI now gate on
//    `status === "open"` directly, real data the backend already enforces
//    the same way (orders.service.ts's `FORWARD_TRANSITIONS`).
//  - `specialInstructions` has no backing column anywhere in `OrderLine` -
//    dropped from the read side (`OrderLineView`) so nothing ever displays a
//    value the backend can't have actually stored. The write-side capture
//    (`ModifierSheetConfirmValue.specialInstructions`, `AddOrderLineInput.
//    specialInstructions`) is left in place unreconciled - CAP-6's counter
//    screen (`counter-view.tsx`) shares both of those types and is
//    out-of-scope here (see spec-2-3-2-4's boundaries); the value is simply
//    accepted and silently dropped server-side today
//    (`ValidationPipe({whitelist:true})`), same latent gap that already
//    existed before this pass, just not this story's to close.
//  - `OrderView.ownerStaffName` is kept as a field name (rather than renamed
//    to `ownerStaffId`) purely because `counter-view.tsx` (CAP-6, also out of
//    scope per spec-2-3-2-4's boundaries) reads `order.ownerStaffName`
//    directly and isn't touched by this pass - the *value* behind that name
//    is now real (the raw owner id, honestly reported), not a fabricated
//    one, satisfying the "never a fabricated real value" rule even though
//    the field name is a legacy holdover. order-taking-view.tsx (in scope)
//    applies its own "You" substitution on top of that raw id at render
//    time, same as open-orders-screen.tsx.
//
// RECONCILED (2026-09-02, restiq-backend#96) - `OrderView` (every one of
// this file's endpoints - get/lines/status/transfer, plus open-orders and
// counter-orders which reuse the same wire shape) now also carries
// `tableLabel: string | null` - the real DiningTable's label for a dine-in
// order, `null` for a counter order (never fabricated). restiq-web#96's
// reported bug ("TABLE 01a06108-…" rendering the raw tableId) is exactly the
// gap this closes: `orderOriginLabel` below now reads `tableLabel`,
// falling back to the raw `tableId` only if the field is somehow missing -
// never the other way round.

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

// --- Wire shapes. The real, verified payloads `GET /pos/v1/orders/:id` and
// every order/order-line mutation endpoint return (orders.dtos.ts's
// `OrderView`/`OrderLineView`, read directly) - raw ids only, no display
// names, no derived totals.

export interface RawOrderLineModifier {
  id: string;
  modifierId: string;
  name: string;
  priceMinor: number;
}

export interface RawOrderLine {
  id: string;
  orderId: string;
  itemId: string;
  variantId: string | null;
  quantity: number;
  unitPriceMinor: number;
  seatNumber: number | null;
  addedByStaffId: string;
  createdAt: string;
  modifiers: RawOrderLineModifier[];
}

export interface RawOrder {
  id: string;
  tenantId: string;
  outletId: string;
  tableId: string | null;
  /** The DiningTable's real label for a dine-in order; `null` for a counter order - see file header. */
  tableLabel: string | null;
  ownerId: string;
  status: "open" | "sent" | "closed";
  tokenNumber: number | null;
  createdAt: string;
  updatedAt: string;
  lines: RawOrderLine[];
}

// --- UI-facing shapes, mapped from the raw wire shapes above (join item/
// variant names against the menu, derive per-line/order totals).

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
  /** Raw staff id - no staff-name lookup exists server-side yet, see file header. */
  addedByStaffId: string;
  /** Optional seat/cover metadata (restiq-web#120: no longer gates send-to-kitchen, and not rendered on this screen); `null` means unassigned. */
  seatNumber: number | null;
}

export interface OrderView {
  id: string;
  /** `null` for a CAP-6 QSR counter order - it has no table at all, never a fabricated empty-string id. */
  tableId: string | null;
  /** The real DiningTable label (e.g. "T1") for a dine-in order; `null` for a counter order - see file header. */
  tableLabel: string | null;
  status: "open" | "sent" | "closed";
  /** Raw owner id, kept under this legacy field name for `counter-view.tsx`'s sake - see file header. */
  ownerStaffName: string;
  lines: OrderLineView[];
  /** Sum of every line's total. Tax breakdown is CAP-7 Bill & Settle's job, not this screen's - no rate is fabricated here. */
  totalMinor: number;
  /** The sequential token number issued for a CAP-6 counter order; `null` for a dine-in (table) order. */
  tokenNumber: number | null;
}

function resolveMenuItem(menu: Pick<PosMenuView, "items"> | undefined, itemId: string): PosMenuItemView | undefined {
  return menu?.items.find((item) => item.id === itemId);
}

/** Falls back to the raw id when the item isn't in the loaded menu (deleted, or no menu given) - never a fabricated name. */
function resolveItemName(menu: Pick<PosMenuView, "items"> | undefined, itemId: string): string {
  return resolveMenuItem(menu, itemId)?.name ?? itemId;
}

function resolveVariantName(menu: Pick<PosMenuView, "items"> | undefined, itemId: string, variantId: string | null): string | null {
  if (variantId === null) return null;
  const item = resolveMenuItem(menu, itemId);
  return item?.variants.find((variant) => variant.id === variantId)?.name ?? variantId;
}

export function toOrderLineView(raw: RawOrderLine, menu?: Pick<PosMenuView, "items">): OrderLineView {
  const modifiers = raw.modifiers.map((modifier) => ({ modifierId: modifier.modifierId, name: modifier.name, priceMinor: modifier.priceMinor }));
  return {
    id: raw.id,
    itemId: raw.itemId,
    itemName: resolveItemName(menu, raw.itemId),
    variantId: raw.variantId,
    variantName: resolveVariantName(menu, raw.itemId, raw.variantId),
    quantity: raw.quantity,
    unitPriceMinor: raw.unitPriceMinor,
    modifiers,
    lineTotalMinor: raw.quantity * computeUnitTotalMinor(raw.unitPriceMinor, modifiers),
    addedByStaffId: raw.addedByStaffId,
    seatNumber: raw.seatNumber,
  };
}

/** `menu` is optional so callers with no menu in scope (e.g. table-map's `startOrder`/`transferOrder`, which never render a line's item/variant name) still get a usable mapping - names simply fall back to raw ids in that case. */
export function toOrderView(raw: RawOrder, menu?: Pick<PosMenuView, "items">): OrderView {
  const lines = raw.lines.map((line) => toOrderLineView(line, menu));
  return {
    id: raw.id,
    tableId: raw.tableId,
    tableLabel: raw.tableLabel,
    status: raw.status,
    ownerStaffName: raw.ownerId,
    tokenNumber: raw.tokenNumber,
    lines,
    totalMinor: computeOrderTotalMinor(lines),
  };
}

/** "Table {tableLabel}" / "Counter" - falls back to the raw tableId only if tableLabel is somehow missing, never the other way round. Same raw-id-fallback convention open-orders-state.ts's `originLabel` uses, kept as a one-liner here rather than a cross-import since the two operate on differently-shaped types. */
export function orderOriginLabel(order: Pick<OrderView, "tableId" | "tableLabel">): string {
  return order.tableId !== null ? `Table ${order.tableLabel ?? order.tableId}` : "Counter";
}

export interface AddOrderLineInput {
  itemId: string;
  variantId?: string;
  quantity: number;
  modifierIds: string[];
  /** Accepted client-side but not persisted server-side - see file header ("specialInstructions has no backing column"). Left in place only because `counter-view.tsx`/`modifier-sheet.tsx` share this type and are out of this reconciliation's scope. */
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

export function computeUnitTotalMinor(unitPriceMinor: number, modifiers: readonly { priceMinor: number }[]): number {
  return unitPriceMinor + modifiers.reduce((sum, modifier) => sum + modifier.priceMinor, 0);
}

export function computeOrderTotalMinor(lines: readonly OrderLineView[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
}

// --- Send-to-kitchen gate. Product decision (2026-09-02, restiq-web#120):
// the CAP-4 "every line needs a seat before fire" rule this used to enforce
// is removed - seats are optional metadata only (restiq-backend's matching
// change drops the `unseated_lines` rejection on send). `seatNumber` stays
// on `OrderLineView` (still real wire data, see file header) but no longer
// gates anything here.

/** Gates the "Send to kitchen" action - disabled, never hidden, same EXPERIENCE.md convention as ModifierSheet's confirm button. Real `Order.status` is forward-only (open->sent->closed, orders.service.ts's `FORWARD_TRANSITIONS`), so "not yet sent" is exactly `status === "open"` - no fabricated `firedAt` timestamp needed. */
export function canSendToKitchen(order: Pick<OrderView, "lines" | "status">): boolean {
  return order.lines.length > 0 && order.status === "open";
}
