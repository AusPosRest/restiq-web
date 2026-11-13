// Card readers and reader orders (restiq-backend#286, restiq-web#429): the shapes the ops console
// and the owner admin both read, and the words they show them in.

export type ReaderModel = "s700" | "wisepos_e";
export type ReaderOrderStatus = "payment_failed" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled";

/** Minor units. The contract sends strings; a number is read the same way. */
export type Minor = string | number;

export interface CardReaderView {
  id: string;
  outletId: string;
  outletName: string;
  label: string;
  /** Stripe's, e.g. stripe_s700, bbpos_wisepos_e, simulated_wisepos_e. */
  deviceType: string;
  serialNumber: string | null;
  status: "online" | "offline" | "unknown";
  simulated: boolean;
}

export interface ReaderPriceView {
  country: string;
  model: ReaderModel;
  displayName: string;
  /** null = not for sale in that country. */
  priceMinor: Minor | null;
  updatedAt: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
}

export interface ReaderOrderView {
  id: string;
  tenantId: string;
  tenantName: string;
  outletId: string;
  outletName: string;
  model: ReaderModel;
  displayName: string;
  quantity: number;
  unitPriceMinor: Minor;
  totalMinor: Minor;
  currency: string;
  shipping: ShippingAddress;
  status: ReaderOrderStatus;
  failureMessage: string | null;
  trackingRef: string | null;
  opsNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MODEL_LABEL: Record<ReaderModel, string> = { s700: "Stripe Reader S700", wisepos_e: "BBPOS WisePOS E" };

const DEVICE_TYPE_LABEL: Record<string, string> = {
  stripe_s700: "Stripe Reader S700",
  bbpos_wisepos_e: "BBPOS WisePOS E",
  simulated_wisepos_e: "WisePOS E (simulated)",
};

/** Stripe's device type in plain words; an unknown one is shown de-snaked rather than hidden. */
export function deviceTypeLabel(deviceType: string): string {
  return DEVICE_TYPE_LABEL[deviceType] ?? deviceType.replace(/_/g, " ");
}

export const ORDER_STATUS_LABEL: Record<ReaderOrderStatus, string> = {
  payment_failed: "Payment failed",
  paid: "Paid",
  ordered: "Ordered",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const CURRENCY_BY_COUNTRY: Record<string, string> = { AU: "AUD", IN: "INR" };

export function currencyForCountry(country: string): string {
  return CURRENCY_BY_COUNTRY[country] ?? "AUD";
}

/** One line for a table cell: "Sam Lee, Sydney NSW 2000". */
export function shippingSummary(shipping: ShippingAddress): string {
  return `${shipping.name}, ${[shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(" ")}`;
}
