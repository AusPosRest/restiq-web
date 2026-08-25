// Pure helpers for P11/P12 (CAP-10): money formatting/parsing for the keypad
// components, and form validation. Kept framework-free so it's cheap to unit
// test directly. AD-4's realm-isolation lint rule (app/pos may not import
// from app/admin or app/ops) means this can't reuse admin's
// menu-state.ts#formatPriceMinor even though the shape is the same idea -
// this is the pos realm's own small copy, not a stray duplicate.

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹" };

/** Cash amounts render with paise, unlike menu prices - an over/short of a few paise still matters. */
export function formatMinor(amountMinor: number, currency = "INR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(amountMinor / 100).toFixed(2)}`;
}

/** BlindCountKeypad/AmountKeypad build up a plain digit string (cents-first, calculator-style); this turns it into minor units. */
export function digitsToMinor(digits: string): number {
  return digits === "" ? 0 : parseInt(digits, 10);
}

export function appendDigit(digits: string, digit: string, maxDigits = 9): string {
  if (digits.length >= maxDigits) return digits;
  const next = digits === "0" ? digit : digits + digit;
  return next.replace(/^0+(?=\d)/, "");
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
  if (digits.length === 0 || digitsToMinor(digits) <= 0) errors.amount = "Enter an amount greater than zero.";
  if (reason.trim().length === 0) errors.reason = "Enter a reason to continue.";
  return errors;
}

export function validateCountedCash(digits: string): string | null {
  if (digits.length === 0) return "Count the cash before submitting.";
  return null;
}
