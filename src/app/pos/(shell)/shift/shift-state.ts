// Pure helpers for P11/P12 (CAP-10): money formatting/parsing for the keypad
// components, and form validation. Kept framework-free so it's cheap to unit
// test directly. AD-4's realm-isolation lint rule (app/pos may not import
// from app/admin or app/ops) means this can't reuse admin's
// menu-state.ts#formatPriceMinor even though the shape is the same idea -
// this is the pos realm's own small copy, not a stray duplicate.

import { formatMoney } from "@/lib/money";

/** Cash amounts render with paise, unlike menu prices - an over/short of a few paise still matters. */
export function formatMinor(amountMinor: number, currency = "INR"): string {
  return formatMoney(amountMinor, currency);
}

/** A plain digit string as a whole number - the tender keypad's whole rupees / dollars and the discount percent. */
export function digitsToMinor(digits: string): number {
  return digits === "" ? 0 : parseInt(digits, 10);
}

export function appendDigit(digits: string, digit: string, maxDigits = 9): string {
  if (digits.length >= maxDigits) return digits;
  const next = digits === "0" ? digit : digits + digit;
  return next.replace(/^0+(?=\d)/, "");
}

// restiq-web#370: the shift keypads (float, cash movement, drawer count) used to read digits as paise,
// so 1000 opened a Rs 10 float while the tender keypad on the same till read it as Rs 1,000. An entry is
// now whole rupees / dollars with an optional decimal part for paise / cents: "1000", "523.4", "523.45".

/** A whole-units entry in minor units. Integer maths - no float rounding on money. */
export function entryToMinor(entry: string): number {
  const [whole, fraction = ""] = entry.split(".");
  return parseInt(whole || "0", 10) * 100 + parseInt(fraction.padEnd(2, "0"), 10);
}

/** Adds a digit or "." to an entry: one decimal point, two decimals, `maxWholeDigits` before the point. */
export function appendEntryKey(entry: string, key: string, maxWholeDigits = 7): string {
  const [whole, fraction] = entry.split(".");
  if (key === ".") return fraction === undefined ? `${whole || "0"}.` : entry;
  if (fraction !== undefined) return fraction.length >= 2 ? entry : entry + key;
  const next = (whole + key).replace(/^0+(?=\d)/, "");
  return next.length > maxWholeDigits ? entry : next;
}

export function validateOpeningFloat(digits: string): string | null {
  if (digits.length === 0) return "Enter the starting float to open the shift.";
  return null;
}

export interface MovementFormErrors {
  amount?: string;
  reason?: string;
}

export function validateMovementForm(digits: string, reason: string): MovementFormErrors {
  const errors: MovementFormErrors = {};
  if (entryToMinor(digits) <= 0) errors.amount = "Enter an amount greater than zero.";
  if (reason.trim().length === 0) errors.reason = "Enter a reason to continue.";
  return errors;
}

export function validateCountedCash(digits: string): string | null {
  if (digits.length === 0) return "Count the cash before submitting.";
  return null;
}
