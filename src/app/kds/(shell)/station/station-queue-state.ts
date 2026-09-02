// Pure K1 station-queue logic (CAP-2, issue #66) - kept free of React/timers
// so ageing-threshold transitions and ticket layout can be unit-tested
// without fake DOM timers, mirroring dashboard-state.ts/sync-health's split
// between logic and rendering.
import type { TicketLineView, TicketView } from "../../api";

export type AgeingLevel = "new" | "ageing" | "urgent";

/**
 * Blue -> yellow -> red exactly at the station's configured minutes
 * (SPEC CAP-2 success criterion, DESIGN.md AgeingFrame). The schema
 * (restiq-backend#70's Station.ageingThresholdMinutes) carries only ONE
 * threshold, not a first/second pair - `screens.md`/DESIGN.md both describe
 * two named cutoffs ("first" and "second/urgent") without giving the second
 * a source, and the Tenant Admin stations panel likewise exposes a single
 * "Ageing threshold (min)" field. This client's documented reading: that one
 * configured value IS the first (blue->yellow) cutoff, and urgent
 * (yellow->red) is 2x it - a deterministic derivation from the one real
 * number rather than inventing a second, unconfigurable schema field. Revisit
 * if a future story adds a real second threshold column.
 */
export function ageingLevel(firedAt: string, ageingThresholdMinutes: number, nowMs: number): AgeingLevel {
  const minutesElapsed = (nowMs - Date.parse(firedAt)) / 60_000;
  if (minutesElapsed >= ageingThresholdMinutes * 2) return "urgent";
  if (minutesElapsed >= ageingThresholdMinutes) return "ageing";
  return "new";
}

/** "MM:SS", uncapped minutes - the largest figure on a ticket (DESIGN.md), tabular-nums in the component. Floors at 0:00 for clock skew rather than showing a negative time. */
export function formatElapsed(firedAt: string, nowMs: number): string {
  const totalSeconds = Math.max(0, Math.floor((nowMs - Date.parse(firedAt)) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Oldest-left (SPEC/DESIGN.md) - the API already returns `firedAt asc`, this is a defensive client-side guarantee, not a re-derivation. */
export function sortOldestFirst(tickets: TicketView[]): TicketView[] {
  return [...tickets].sort((a, b) => Date.parse(a.firedAt) - Date.parse(b.firedAt));
}

/**
 * Dine-in vs counter is derived, not fetched: TicketView carries no explicit
 * order-type field (restiq-backend#70's real DTO - verified, not guessed),
 * but `tableLabel` is only ever non-null for a table order (startCounterOrder()
 * always has `tableId: null` per src/app/pos/api.ts's header) so presence of
 * a table label is structurally equivalent to "dine-in".
 */
export function orderTypeLabel(ticket: Pick<TicketView, "tableLabel">): "Dine-in" | "Counter" {
  return ticket.tableLabel ? "Dine-in" : "Counter";
}

/**
 * "#1042" from the real tokenNumber (counter orders), "Table T1" for a
 * dine-in order (which by design never gets a token - see OrderView's
 * tokenNumber comment), and only as a last resort a short id fragment
 * (defensive - every fired order is one of the two above).
 */
export function ticketDisplayNumber(ticket: Pick<TicketView, "tokenNumber" | "tableLabel" | "orderId">): string {
  if (ticket.tokenNumber != null) return `#${ticket.tokenNumber}`;
  if (ticket.tableLabel) return `Table ${ticket.tableLabel}`;
  return `#${ticket.orderId.slice(0, 8)}`;
}

/**
 * Groups a ticket's lines by `addOnBatch` (0 = the original fire, 1+ = the
 * Nth batch appended afterwards - restiq-backend#70's wiki), sorted so the
 * original section renders first and each ADD-ON batch after it in fire
 * order (DESIGN.md/EXPERIENCE.md: "ADD-ON separator... never render an
 * ADD-ON as a new ticket - the separator inside the parent is the contract").
 */
export function groupLinesByBatch(lines: TicketLineView[]): { batch: number; lines: TicketLineView[] }[] {
  const byBatch = new Map<number, TicketLineView[]>();
  for (const line of lines) {
    const group = byBatch.get(line.addOnBatch);
    if (group) group.push(line);
    else byBatch.set(line.addOnBatch, [line]);
  }
  return [...byBatch.entries()].sort(([a], [b]) => a - b).map(([batch, batchLines]) => ({ batch, lines: batchLines }));
}
