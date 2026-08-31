// Pure helpers for Q5 Table Order (CAP-3): money formatting and the
// own-line-vs-everyone-else's-line check the whole editable/read-only split
// hinges on. Kept framework-free, same split as pos/(shell)/shift/
// shift-state.ts, so it's unit-testable without a DOM.
import type { CartLineView, PlacedOrderLineView, PlacedOrderView, TableCartView } from "./cart-api";

// AD-4's realm-isolation rule (app/qr may not import from app/pos) means
// this can't reuse pos/(shell)/shift/shift-state.ts#formatMinor even though
// the shape is identical - the guest realm's own small copy, not a stray
// duplicate.
const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹" };

export function formatMinor(amountMinor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(amountMinor / 100).toFixed(2)}`;
}

/** Whether this line was added by the signed-in guest - the only lines this UI ever renders edit controls for. */
export function isOwnLine(line: CartLineView, myGuestId: string): boolean {
  return line.guestId === myGuestId;
}

export function isCartEmpty(cart: TableCartView): boolean {
  return cart.guests.every((guest) => guest.lines.length === 0);
}

export interface PlacedOrderGuestGroup {
  guestId: string;
  guestName: string;
  lines: PlacedOrderLineView[];
}

/** Groups a placed order's flat line list by guest, in first-appearance order, for the confirmation view. */
export function groupPlacedOrderLinesByGuest(order: PlacedOrderView): PlacedOrderGuestGroup[] {
  const groups: PlacedOrderGuestGroup[] = [];
  const byGuestId = new Map<string, PlacedOrderGuestGroup>();
  for (const line of order.lines) {
    let group = byGuestId.get(line.guestId);
    if (!group) {
      group = { guestId: line.guestId, guestName: line.guestName, lines: [] };
      byGuestId.set(line.guestId, group);
      groups.push(group);
    }
    group.lines.push(line);
  }
  return groups;
}
