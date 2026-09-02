// Pure K3 bumped-view logic (CAP-4, issue #71; clarity pass issue #134) -
// mirrors station-queue-state.ts's split between logic and rendering so
// ordering/formatting stay unit-testable without a DOM.
import { formatElapsed } from "../station/station-queue-state";
import type { BumpedTicketView } from "../../api";

/**
 * Newest-bumped-first (this story's documented reading of CAP-4's
 * undocumented ordering: the backend's `bumped()` already returns
 * `bumpedAt desc`, matching K1's `sortOldestFirst` precedent of a defensive
 * client-side re-sort rather than trusting response order silently). Falls
 * back to 0 for the type-only null case (every ticket in this list is
 * `status: "bumped"`, which always carries a real `bumpedAt`).
 */
export function sortBumpedNewestFirst(tickets: BumpedTicketView[]): BumpedTicketView[] {
  return [...tickets].sort((a, b) => (Date.parse(b.bumpedAt ?? "") || 0) - (Date.parse(a.bumpedAt ?? "") || 0));
}

/** Local wall-clock label, e.g. "10:00 AM" - shared by the bumped-at and last-recall lines. */
function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Static "Bumped hh:mm · took m:ss" (issue #134) - replaces the live
 * ageing clock on a done ticket, which had no reason to keep counting once
 * the ticket was bumped. `took` reuses `formatElapsed`'s exact "m:ss"
 * format, fed the fixed `bumpedAt` instant instead of a ticking `now`, so
 * the figure is computed once and never changes again.
 */
export function formatBumpedSummary(ticket: Pick<BumpedTicketView, "firedAt" | "bumpedAt">): string {
  const bumpedAtIso = ticket.bumpedAt ?? ticket.firedAt;
  return `Bumped ${formatClockTime(bumpedAtIso)} · took ${formatElapsed(ticket.firedAt, Date.parse(bumpedAtIso))}`;
}

/**
 * One quiet fact, e.g. "Recalled 2× · last 10:15 AM" (issue #134: recall
 * history should read as a calm line, not a red badge per recall). Null for
 * a ticket that's never been recalled - the caller renders nothing.
 */
export function formatRecallSummary(recallHistory: string[]): string | null {
  if (recallHistory.length === 0) return null;
  const last = recallHistory[recallHistory.length - 1];
  return `Recalled ${recallHistory.length}× · last ${formatClockTime(last)}`;
}
