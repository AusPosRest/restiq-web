// Plans page (issue #323): form <-> API shaping for one plan price row.
import { currencyForCountry, type ReaderPriceView } from "@/lib/card-readers";
import type { PlanPriceView } from "../api";

export interface PlanPriceForm {
  /** Major units as typed; blank = on quote. */
  price: string;
  discount: string;
}

export const COUNTRY_LABEL: Record<PlanPriceView["country"], string> = { IN: "India", AU: "Australia" };
export const PLAN_LABEL: Record<PlanPriceView["plan"], string> = { standard: "Standard", enterprise: "Enterprise" };
export const CURRENCY_SYMBOL: Record<PlanPriceView["currency"], string> = { INR: "₹", AUD: "A$" };

export function formFromPrice(row: PlanPriceView): PlanPriceForm {
  return { price: row.monthlyPriceMinor === null ? "" : String(row.monthlyPriceMinor / 100), discount: String(row.annualDiscountPercent) };
}

export function validatePlanPriceForm(form: PlanPriceForm): { monthlyPriceMinor: number | null; annualDiscountPercent: number } | { error: string } {
  const price = form.price.trim();
  const major = price === "" ? null : Number(price);
  if (major !== null && (!Number.isFinite(major) || major < 0)) return { error: "Enter a price of 0 or more, or leave it blank for on quote." };
  const discount = Number(form.discount);
  if (!Number.isInteger(discount) || discount < 0 || discount > 100) return { error: "The annual discount is a whole number from 0 to 100." };
  return { monthlyPriceMinor: major === null ? null : Math.round(major * 100), annualDiscountPercent: discount };
}

export function isDirty(form: PlanPriceForm, row: PlanPriceView): boolean {
  const original = formFromPrice(row);
  return form.price.trim() !== original.price || form.discount.trim() !== original.discount;
}

// Card readers (restiq-web#429): one model's price in one country; blank = not for sale.
export function readerPriceForm(row: ReaderPriceView): string {
  return row.priceMinor === null ? "" : String(Number(row.priceMinor) / 100);
}

export function validateReaderPrice(price: string): { priceMinor: number | null } | { error: string } {
  const trimmed = price.trim();
  if (trimmed === "") return { priceMinor: null };
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return { error: "Enter a price above 0, or leave it blank for not for sale." };
  return { priceMinor: Math.round(major * 100) };
}

/** Reader prices come keyed by any country code; an unknown one is shown as the code. */
export function countryLabel(country: string): string {
  return (COUNTRY_LABEL as Record<string, string>)[country] ?? country;
}

export function currencySymbolFor(country: string): string {
  return (CURRENCY_SYMBOL as Record<string, string>)[currencyForCountry(country)] ?? "";
}
