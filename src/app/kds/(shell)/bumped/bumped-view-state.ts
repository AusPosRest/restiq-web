// Pure K3 bumped-view logic (CAP-4, issue #71) - mirrors station-queue-state.ts's
// split between logic and rendering so ordering/formatting stay unit-testable
// without a DOM.
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

/** Oldest-to-newest local clock-time labels for a ticket's recall history strip. */
export function formatRecallTimes(recallHistory: string[]): string[] {
  return recallHistory.map((iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
}
