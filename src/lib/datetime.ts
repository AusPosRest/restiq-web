// PE-7: India and Australia both read dates day-first, so every console
// formats dates in an explicit day-first locale instead of the browser's
// default (often en-US, where 10/11/2026 reads as 11 October). en-IN and
// en-AU print the same day-first shapes ("11 Oct 2026, 6:13 pm").
export const DATE_LOCALE = "en-IN";

/** "11 Oct 2026, 6:13 pm" */
export function formatDateTime(value: string | Date, locale = DATE_LOCALE): string {
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** "11 Oct 2026" */
export function formatDate(value: string | Date, locale = DATE_LOCALE): string {
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
