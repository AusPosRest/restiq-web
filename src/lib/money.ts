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

/**
 * CU-11: rupee cash is settled to the nearest rupee (50 paise rounds up) -
 * the adjustment to add to what is due: -40 for ₹890.40, +40 for ₹890.60.
 * 0 for any other currency. Display / tender side only: the bill and its
 * tenders keep the exact total (restiq-backend's finalize requires it).
 */
export function cashRoundOffMinor(dueMinor: number, currency: string): number {
  return currency === "INR" ? Math.round(dueMinor / 100) * 100 - dueMinor : 0;
}
