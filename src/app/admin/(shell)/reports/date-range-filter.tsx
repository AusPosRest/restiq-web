"use client";

// The outlet-local From/To date filter shared by the Payments and Top items
// reports (payments-state.ts's DateRangeQuery/toIsoRange do the date math).
import type { DateRangeQuery } from "./payments-state";

const DATE_INPUT_CLASS =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const FILTER_LABEL_CLASS = "font-label mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

export function DateRangeFilter({
  idPrefix,
  range,
  onChange,
}: Readonly<{ idPrefix: string; range: DateRangeQuery; onChange: (update: (current: DateRangeQuery) => DateRangeQuery) => void }>) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/40 bg-card p-4">
      <div>
        <label htmlFor={`${idPrefix}-filter-from`} className={FILTER_LABEL_CLASS}>
          From
        </label>
        <input
          id={`${idPrefix}-filter-from`}
          data-testid={`${idPrefix}-filter-from`}
          type="date"
          value={range.fromDate}
          max={range.toDate}
          onChange={(event) => onChange((current) => ({ ...current, fromDate: event.target.value }))}
          className={DATE_INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-filter-to`} className={FILTER_LABEL_CLASS}>
          To
        </label>
        <input
          id={`${idPrefix}-filter-to`}
          data-testid={`${idPrefix}-filter-to`}
          type="date"
          value={range.toDate}
          min={range.fromDate}
          onChange={(event) => onChange((current) => ({ ...current, toDate: event.target.value }))}
          className={DATE_INPUT_CLASS}
        />
      </div>
    </div>
  );
}
