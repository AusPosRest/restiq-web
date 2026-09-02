// WaitingOnPanel (DESIGN.md) - expo's sidebar of exactly the not-yet-bumped
// items (SPEC CAP-3 success criterion), oldest-first. Each row's ageing
// color reuses K1's `ageingLevel` against the line's own owning ticket
// (see expo-state.ts's `buildWaitingOnEntries`) - the same fixed, never-
// themeable blue/yellow/red scale as every other clock on this surface.
import { Clock } from "lucide-react";
import { ageingLevel, formatElapsed, ticketDisplayNumber, type AgeingLevel } from "../station/station-queue-state";
import type { WaitingOnEntry } from "./expo-state";

const TEXT_CLASSES: Record<AgeingLevel, string> = {
  new: "text-ticket-new",
  ageing: "text-ticket-ageing",
  urgent: "text-ticket-urgent",
};

export function WaitingOnPanel({
  entries,
  ageingThresholdMinutesFor,
  nowMs,
}: Readonly<{
  entries: WaitingOnEntry[];
  ageingThresholdMinutesFor: (stationId: string | null) => number;
  nowMs: number;
}>) {
  return (
    <aside data-testid="kds-waiting-on-panel" className="flex w-72 shrink-0 flex-col border-l border-border/40 bg-card">
      <p className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        <Clock className="size-3.5" aria-hidden="true" />
        Waiting on
      </p>

      {entries.length === 0 && (
        <p data-testid="kds-waiting-on-empty" className="p-4 text-sm text-muted-foreground">
          Nothing waiting - every open order is ready.
        </p>
      )}

      {entries.length > 0 && (
        <ul data-testid="kds-waiting-on-list" className="flex-1 space-y-2 overflow-y-auto p-3">
          {entries.map((entry) => {
            const level = ageingLevel(entry.firedAt, ageingThresholdMinutesFor(entry.stationId), nowMs);
            return (
              <li key={entry.line.id} data-testid={`kds-waiting-on-${entry.line.id}`} className="rounded-lg border border-border/40 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="flex items-baseline gap-1.5 text-sm font-semibold text-foreground">
                    <span className="font-headline font-bold tabular-nums">{entry.line.quantity}</span>
                    <span>
                      {entry.line.itemName}
                      {entry.line.variantName ? ` (${entry.line.variantName})` : ""}
                    </span>
                  </p>
                  <p data-testid={`kds-waiting-on-${entry.line.id}-elapsed`} className={`font-headline text-base font-bold tabular-nums ${TEXT_CLASSES[level]}`}>
                    {formatElapsed(entry.firedAt, nowMs)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.stationName ?? "Unrouted"} - {ticketDisplayNumber(entry)}
                  {entry.tableLabel ? ` - ${entry.tableLabel}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
