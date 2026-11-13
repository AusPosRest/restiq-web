// Payments tab (issue #425): form <-> API shaping. Percent is typed as %, sent as basis
// points; the fixed fee is typed in major units, sent as a minor-unit string. Parsed from
// the text (no float maths) so 0.07 never becomes 6.999.
import type { PaymentMethod, PaymentsView } from "../../api";

export interface PaymentsForm {
  methods: PaymentMethod[];
  /** Percent as typed, e.g. "2.5". */
  percent: string;
  /** Major units as typed, e.g. "0.30". */
  fixed: string;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = { card: "Card", apple_pay: "Apple Pay", google_pay: "Google Pay" };
export const ALL_METHODS: PaymentMethod[] = ["card", "apple_pay", "google_pay"];

const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "2.5" -> 250; null when not a number from 0 to 100 with at most 2 decimals. */
export function percentToBps(text: string): number | null {
  const m = DECIMAL.exec(text.trim());
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bps <= 10000 ? bps : null;
}

/** "0.30" -> "30"; null when not a non-negative amount with at most 2 decimals. */
export function majorToMinor(text: string): string | null {
  const m = DECIMAL.exec(text.trim());
  if (!m) return null;
  return `${m[1]}${(m[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

export function bpsToPercent(bps: number): string {
  return String(bps / 100);
}

export function minorToMajor(minor: string): string {
  const padded = minor.padStart(3, "0");
  const whole = padded.slice(0, -2);
  const cents = padded.slice(-2);
  return cents === "00" ? whole : `${whole}.${cents}`;
}

export function formFromPayments(view: PaymentsView): PaymentsForm {
  return { methods: view.allowedMethods, percent: bpsToPercent(view.feePercentBps), fixed: minorToMajor(view.feeFixedMinor) };
}

export interface PaymentsPatch {
  allowedMethods: PaymentMethod[];
  feePercentBps: number;
  feeFixedMinor: string;
}

export function validatePaymentsForm(form: PaymentsForm): PaymentsPatch | { error: string } {
  if (form.methods.length === 0) return { error: "Keep at least one payment method on." };
  const feePercentBps = percentToBps(form.percent);
  if (feePercentBps === null) return { error: "The percentage fee is a number from 0 to 100 with up to 2 decimals." };
  const feeFixedMinor = majorToMinor(form.fixed);
  if (feeFixedMinor === null) return { error: "The fixed fee is an amount of 0 or more with up to 2 decimals." };
  return { allowedMethods: ALL_METHODS.filter((m) => form.methods.includes(m)), feePercentBps, feeFixedMinor };
}

export function isDirty(form: PaymentsForm, view: PaymentsView): boolean {
  const original = formFromPayments(view);
  const methods = (list: PaymentMethod[]) => [...list].sort().join();
  return methods(form.methods) !== methods(original.methods) || form.percent.trim() !== original.percent || form.fixed.trim() !== original.fixed;
}
