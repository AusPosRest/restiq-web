// One money formatter for every surface (PE-10, PE-23): the market's own
// symbol (₹ for INR, A$ for AUD) and digit grouping (en-IN 1,23,456.78 /
// en-AU 123,456.78), amounts in integer minor units.
const SYMBOLS: Record<string, string> = { INR: "₹", AUD: "A$" };
const LOCALES: Record<string, string> = { INR: "en-IN", AUD: "en-AU" };

/** en-IN for INR, en-AU for AUD - the locale dates and numbers are shown in for that market. */
export function localeForCurrency(currency: string): string {
  return LOCALES[currency] ?? "en-IN";
}

function format(amountMinor: number, currency: string, fractionDigits: number): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const number = (Math.abs(amountMinor) / 100).toLocaleString(localeForCurrency(currency), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${amountMinor < 0 ? "-" : ""}${symbol}${number}`;
}

/** Accounting amounts, always to the paisa/cent: ₹1,363.95, A$12.50. */
export function formatMoney(amountMinor: number, currency: string): string {
  return format(amountMinor, currency, 2);
}

/** Menu prices: whole units when there is nothing after the point (₹340), else to the paisa (₹199.50) - never rounded away. */
export function formatPrice(amountMinor: number, currency: string): string {
  return format(amountMinor, currency, amountMinor % 100 === 0 ? 0 : 2);
}

const CASH_ROUNDING_UNIT_MINOR: Record<string, number> = { INR: 100, AUD: 5 };

/**
 * CU-11 / restiq-web#377: cash is settled to the market's smallest coin -
 * nearest rupee for INR, nearest 5 cents for AUD, half rounds up - and this is
 * the adjustment to add to the cash due: -40 for ₹890.40, +2 for A$12.33.
 * 0 for any other currency or nothing due. Must match restiq-backend's
 * bill-core cashRoundOffMinor exactly: finalize accepts the cash share
 * rounded this way and stores the difference as the bill's roundOffMinor.
 */
export function cashRoundOffMinor(dueMinor: number, currency: string): number {
  const unit = CASH_ROUNDING_UNIT_MINOR[currency];
  if (!unit || dueMinor <= 0) return 0;
  return Math.floor((dueMinor * 2 + unit) / (2 * unit)) * unit - dueMinor;
}
