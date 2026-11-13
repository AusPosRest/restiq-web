// Settings > Card readers (restiq-web#429): the owner's "Order a reader" form -> POST body,
// the total it charges, and where each order is on its way.
import type { ReaderModel, ReaderOrderStatus, ReaderPriceView, ShippingAddress } from "@/lib/card-readers";

export const MAX_QUANTITY = 5;

export interface OrderForm {
  model: ReaderModel | "";
  quantity: number;
  outletId: string;
  shipping: Required<ShippingAddress>;
}

export interface OrderBody {
  outletId: string;
  model: ReaderModel;
  quantity: number;
  shipping: ShippingAddress;
}

export function emptyOrderForm(outletId: string, outletAddress: string): OrderForm {
  return { model: "", quantity: 1, outletId, shipping: { name: "", line1: outletAddress, line2: "", city: "", state: "", postcode: "", phone: "" } };
}

/** Unit price x quantity in minor units; null until a priced model is chosen. */
export function orderTotalMinor(prices: ReaderPriceView[], model: ReaderModel | "", quantity: number): number | null {
  const price = prices.find((p) => p.model === model)?.priceMinor;
  return price === undefined || price === null ? null : Number(price) * quantity;
}

export function validateOrderForm(form: OrderForm, prices: ReaderPriceView[]): OrderBody | { error: string } {
  if (!form.model || orderTotalMinor(prices, form.model, 1) === null) return { error: "Choose a reader." };
  if (!Number.isInteger(form.quantity) || form.quantity < 1 || form.quantity > MAX_QUANTITY) return { error: `Order between 1 and ${MAX_QUANTITY} readers.` };
  if (!form.outletId) return { error: "Choose the outlet the readers are for." };
  const s = Object.fromEntries(Object.entries(form.shipping).map(([k, v]) => [k, v.trim()])) as Required<ShippingAddress>;
  if (!s.name || !s.line1 || !s.city || !s.state || !s.postcode) return { error: "Fill in the name, street, city, state and postcode to ship to." };
  if (!/^\d{3,10}$/.test(s.postcode)) return { error: "The postcode is digits only." };
  if ((s.phone.match(/\d/g) ?? []).length < 6 || !/^[+\d\s()-]+$/.test(s.phone)) return { error: "Enter a phone number the courier can call." };
  const { line2, ...rest } = s;
  return { outletId: form.outletId, model: form.model, quantity: form.quantity, shipping: line2 ? { ...rest, line2 } : rest };
}

export const PROGRESS_STEPS = ["paid", "ordered", "shipped", "delivered"] as const;

/** How many progress steps are done, or null for an order that stopped (payment failed / cancelled). */
export function progressIndex(status: ReaderOrderStatus): number | null {
  const index = (PROGRESS_STEPS as readonly string[]).indexOf(status);
  return index === -1 ? null : index;
}
