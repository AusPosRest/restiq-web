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
//  - (restiq-backend#210) the order now also carries ownerName, and each
//    line addedByStaffName, note (special instructions) and sentToKitchen -
//    screens show names (or "You"), never raw staff ids.
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

import type { ComboMenuView } from "@/lib/combo";

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
  /** Issue #230: null when there is none or the outlet turned Menu Photos off; optional for an older backend. */
  photoUrl?: string | null;
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
  /** restiq-backend#160: live combos with outlet availability. Optional so older fixtures and caches still type. */
  combos?: ComboMenuView[];
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
  /** Null on a combo's parent line (restiq-backend#160). */
  itemId: string | null;
  variantId: string | null;
  comboId?: string | null;
  comboName?: string | null;
  /** Set on each item picked inside a combo - points at the combo's line. */
  parentLineId?: string | null;
  quantity: number;
  unitPriceMinor: number;
  seatNumber: number | null;
  addedByStaffId: string | null;
  /** restiq-backend#210: the adder's name (null for a guest line); optional for an older backend. */
  addedByStaffName?: string | null;
  /** restiq-backend#210: special instructions typed on the till. */
  note?: string | null;
  /** restiq-backend#210: true once the kitchen has this line. Older backends: absent - treated as sent once the order is. */
  sentToKitchen?: boolean;
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
  /** restiq-backend#210: the owner's display name; optional for an older backend. */
  ownerName?: string | null;
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
  /** Empty on a combo line - see comboId. */
  itemId: string;
  itemName: string;
  /** restiq-web#264: a combo line. Its picks are folded in: components names them, lineTotalMinor includes their extra charges. Combos can only be removed, not stepped. */
  comboId: string | null;
  components: string[];
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  modifiers: OrderLineModifierView[];
  lineTotalMinor: number;
  /** Raw staff id - compare with the viewer's own id to show "You". Null on a guest (QR) line. */
  addedByStaffId: string | null;
  /** The adder's name from the server (restiq-backend#210), or null when unknown. */
  addedByStaffName: string | null;
  /** Special instructions for the kitchen ("less spicy"), or null. */
  note: string | null;
  /** True once the kitchen has this line - it can then only be voided with a manager PIN (CU-15). */
  sentToKitchen: boolean;
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
  /** Raw owner id - compare with the viewer's own id. Null for a QR order no staff member has taken over yet. */
  ownerStaffId: string | null;
  /** The owner's name (restiq-backend#210); null when the server didn't send one. */
  ownerName: string | null;
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

const rawLineTotal = (raw: RawOrderLine) => raw.quantity * computeUnitTotalMinor(raw.unitPriceMinor, raw.modifiers);

/** "2× Garlic naan (Less spicy)" - one pick inside a combo, per combo. */
function componentLabel(child: RawOrderLine, parent: RawOrderLine, menu?: Pick<PosMenuView, "items">): string {
  const perCombo = child.quantity / parent.quantity;
  const itemId = child.itemId ?? "";
  const extras = [resolveVariantName(menu, itemId, child.variantId), ...child.modifiers.map((m) => m.name)].filter(Boolean);
  return `${perCombo > 1 ? `${perCombo}× ` : ""}${resolveItemName(menu, itemId)}${extras.length ? ` (${extras.join(", ")})` : ""}`;
}

export function toOrderLineView(
  raw: RawOrderLine,
  menu?: Pick<PosMenuView, "items">,
  children: readonly RawOrderLine[] = [],
  orderSent = false,
): OrderLineView {
  // An older backend has no per-line flag: fall back to the order's status.
  const sent = raw.sentToKitchen ?? orderSent;
  const modifiers = raw.modifiers.map((modifier) => ({ modifierId: modifier.modifierId, name: modifier.name, priceMinor: modifier.priceMinor }));
  if (raw.comboId) {
    const lineTotalMinor = children.reduce((sum, child) => sum + rawLineTotal(child), rawLineTotal(raw));
    return {
      id: raw.id,
      itemId: "",
      itemName: raw.comboName ?? "Combo",
      comboId: raw.comboId,
      components: children.map((child) => componentLabel(child, raw, menu)),
      variantId: null,
      variantName: null,
      quantity: raw.quantity,
      unitPriceMinor: Math.round(lineTotalMinor / raw.quantity),
      modifiers: [],
      lineTotalMinor,
      addedByStaffId: raw.addedByStaffId,
      addedByStaffName: raw.addedByStaffName ?? null,
      note: raw.note ?? null,
      sentToKitchen: sent || children.some((child) => child.sentToKitchen === true),
      seatNumber: raw.seatNumber,
    };
  }
  const itemId = raw.itemId ?? "";
  return {
    id: raw.id,
    itemId,
    itemName: resolveItemName(menu, itemId),
    comboId: null,
    components: [],
    variantId: raw.variantId,
    variantName: resolveVariantName(menu, itemId, raw.variantId),
    quantity: raw.quantity,
    unitPriceMinor: raw.unitPriceMinor,
    modifiers,
    lineTotalMinor: raw.quantity * computeUnitTotalMinor(raw.unitPriceMinor, modifiers),
    addedByStaffId: raw.addedByStaffId,
    addedByStaffName: raw.addedByStaffName ?? null,
    note: raw.note ?? null,
    sentToKitchen: sent,
    seatNumber: raw.seatNumber,
  };
}

/** `menu` is optional so callers with no menu in scope (e.g. table-map's `startOrder`/`transferOrder`, which never render a line's item/variant name) still get a usable mapping - names simply fall back to raw ids in that case. */
export function toOrderView(raw: RawOrder, menu?: Pick<PosMenuView, "items">): OrderView {
  // A combo's picks are shown inside the combo's own line.
  const orderSent = raw.status !== "open";
  const lines = raw.lines
    .filter((line) => !line.parentLineId)
    .map((line) => toOrderLineView(line, menu, raw.lines.filter((child) => child.parentLineId === line.id), orderSent));
  return {
    id: raw.id,
    tableId: raw.tableId,
    tableLabel: raw.tableLabel,
    status: raw.status,
    ownerStaffId: raw.ownerId,
    ownerName: raw.ownerName ?? null,
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
  /** Special instructions for the kitchen - stored on the line since restiq-backend#210 (CU-12). */
  note?: string;
}

// --- Money formatting. AD-4 (app/pos may not import from app/admin/app/ops)
// means this can't reuse admin's menu-state.ts#formatPriceMinor even though
// the shape is identical - the pos realm's own small copy, same convention
// already established by shift-state.ts#formatMinor.

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹" };

/** Menu/order prices render whole units when even (₹340, the P3/P4 mocks), with paise otherwise (₹289.50). */
export function formatPriceMinor(priceMinor: number, currency = "INR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  // PE-12: paise are shown when there are any (₹289.50), so the menu never disagrees with the bill.
  return `${symbol}${(priceMinor / 100).toFixed(priceMinor % 100 === 0 ? 0 : 2)}`;
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

/** Lines the kitchen doesn't have yet - restiq-backend#210: items added after the first send wait for Send to kitchen too (CU-15). */
export function unsentLineCount(order: Pick<OrderView, "lines">): number {
  return order.lines.filter((line) => !line.sentToKitchen).length;
}

/** Gates the "Send to kitchen" action - disabled, never hidden, same EXPERIENCE.md convention as ModifierSheet's confirm button. */
export function canSendToKitchen(order: Pick<OrderView, "lines" | "status">): boolean {
  return order.status !== "closed" && unsentLineCount(order) > 0;
}

/** "You" for the viewer, else the server-sent name; never a raw id (SE-22). */
export function staffLabel(staffId: string | null, name: string | null, currentStaffId: string): string {
  if (staffId === null) return "Guest";
  if (staffId === currentStaffId) return "You";
  return name ?? "Another staff member";
}
