// Issue #403: the tenant's currency for guest screens that have no priced
// line of their own. The cart only knows it from its lines - an empty cart
// (before ordering, or once placing an order has emptied it) falls back to
// INR server-side - so read it off the menu, the same source the menu's own
// prices use (every item/variant/combo carries its currency, AD-11).
import { guestApi } from "./api-client";

interface Priced {
  currency?: string | null;
}

interface MenuLike {
  categories?: Array<{ items?: Array<Priced & { variants?: Priced[] }> }>;
  combos?: Priced[];
}

export function menuCurrency(menu: unknown): string | null {
  const { categories, combos } = (menu ?? {}) as MenuLike;
  if (!Array.isArray(categories)) return null;
  const items = categories.flatMap((category) => category.items ?? []);
  const priced = [...items, ...items.flatMap((item) => item.variants ?? []), ...(combos ?? [])];
  return priced.find((row) => row.currency)?.currency ?? null;
}

/** GET /guest/v1/menu - null when the menu can't be read or carries no price. */
export function fetchMenuCurrency(): Promise<string | null> {
  return guestApi<unknown>("menu").then(menuCurrency, () => null);
}
