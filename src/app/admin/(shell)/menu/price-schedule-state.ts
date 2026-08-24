// Pure state for the "Schedule a price change" form (EXPERIENCE.md: price
// edits show current + a schedule option, never an in-place overwrite). A
// price change is security-relevant per SPEC's audit constraint, so it
// always carries a reason and is applied through its own pessimistic action,
// separate from the drawer's routine-field Save.

export type PriceScheduleMode = "today" | "schedule";

export interface PriceScheduleForm {
  mode: PriceScheduleMode;
  effectiveDate: string;
  dineIn: string;
  delivery: string;
  reason: string;
}

export function initialPriceScheduleForm(current: { dineInPriceMinor: number; deliveryPriceMinor: number }): PriceScheduleForm {
  return {
    mode: "today",
    effectiveDate: "",
    dineIn: (current.dineInPriceMinor / 100).toFixed(2),
    delivery: (current.deliveryPriceMinor / 100).toFixed(2),
    reason: "",
  };
}

export interface PriceScheduleErrors {
  effectiveDate?: string;
  dineIn?: string;
  delivery?: string;
  reason?: string;
}

function todayIsoDate(today: Date): string {
  return today.toISOString().slice(0, 10);
}

function isValidMoney(value: string): boolean {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0;
}

export function validatePriceScheduleForm(form: PriceScheduleForm, today: Date): PriceScheduleErrors {
  const errors: PriceScheduleErrors = {};
  if (!isValidMoney(form.dineIn)) errors.dineIn = "Enter a valid dine-in price.";
  if (!isValidMoney(form.delivery)) errors.delivery = "Enter a valid delivery price.";
  if (form.mode === "schedule") {
    if (!form.effectiveDate) errors.effectiveDate = "Pick a date for this change.";
    else if (form.effectiveDate <= todayIsoDate(today)) errors.effectiveDate = "Pick a date after today.";
  }
  if (!form.reason.trim()) errors.reason = "Add a reason for this price change.";
  return errors;
}

export function priceScheduleFormIsValid(form: PriceScheduleForm, today: Date): boolean {
  return Object.keys(validatePriceScheduleForm(form, today)).length === 0;
}

/** null effectiveAt means "apply now" - the caller sends it straight through
 * as the new current price version. */
export function priceScheduleEffectiveAt(form: PriceScheduleForm): string | null {
  if (form.mode === "today") return null;
  return new Date(`${form.effectiveDate}T00:00:00.000Z`).toISOString();
}
