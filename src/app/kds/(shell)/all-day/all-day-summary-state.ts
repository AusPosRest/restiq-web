// Pure K4 all-day-summary logic (CAP-5, issue #72) - kept free of
// React/timers, mirroring station-queue-state.ts's split between logic and
// rendering.
import type { AllDaySummaryEntryView } from "../../api";

/**
 * Highest-count-first (this story's documented sort choice - SPEC CAP-5's
 * success line only requires counts to derive from real queued lines and
 * decrement on bump; it doesn't mandate an order). The backend returns
 * alphabetical-by-name (restiq-backend's tickets.service.ts), which buries
 * what the kitchen most needs to see at a glance on a wall display: what's
 * busiest right now. Ties keep the backend's alphabetical order (a stable
 * sort on an already-alphabetical array), so the grid doesn't jitter
 * item-to-item between polls when two counts happen to match.
 */
export function sortHighestCountFirst(entries: AllDaySummaryEntryView[]): AllDaySummaryEntryView[] {
  return [...entries].sort((a, b) => b.quantity - a.quantity);
}
