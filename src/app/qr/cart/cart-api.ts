// CAP-3 shared table cart: read + own-line mutations against the real,
// merged restiq-backend guest/v1/cart contract (src/guest/cart/cart.dtos.ts,
// cart.controller.ts, read directly - not a self-authored guess). The shape
// below is copied field-for-field from CartLineModifierView/CartLineView/
// GuestCartView/TableCartView there.
import { guestApi } from "../api-client";

export interface CartLineModifierView {
  id: string;
  name: string;
  priceMinor: number;
}

export interface CartLineView {
  id: string;
  guestId: string;
  guestName: string;
  itemId: string;
  itemName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  unitPriceMinor: number;
  modifiers: CartLineModifierView[];
  lineTotalMinor: number;
  createdAt: string;
}

export interface GuestCartView {
  guestId: string;
  guestName: string;
  lines: CartLineView[];
  subtotalMinor: number;
}

export interface TableCartView {
  sessionId: string;
  guests: GuestCartView[];
  totalMinor: number;
  currency: string;
}

/** GET /guest/v1/cart - the whole table's shared cart, grouped by guest. */
export function fetchCart(): Promise<TableCartView> {
  return guestApi<TableCartView>("cart");
}

/** PATCH /guest/v1/cart/lines/:id - quantity only (own line; a 403 on someone else's line is a backend guard, never reachable from this UI - see cart-screen.tsx). */
export function updateCartLineQuantity(lineId: string, quantity: number): Promise<TableCartView> {
  return guestApi<TableCartView>(`cart/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
}

/** DELETE /guest/v1/cart/lines/:id */
export function removeCartLine(lineId: string): Promise<TableCartView> {
  return guestApi<TableCartView>(`cart/lines/${lineId}`, { method: "DELETE" });
}
