// Pure K2 expo logic (CAP-3, issue #70) - kept free of React/timers, same
// split as station-queue-state.ts. Consolidates the real ExpoOrderView shape
// (restiq-backend#70's tickets.dtos.ts, verified directly) into what
// ExpoOrderRow/WaitingOnPanel render: per-station item roll-ups, and the
// order's own ageing state from its oldest not-yet-bumped ticket.
import type { ExpoOrderView, TicketLineView } from "../../api";

/** One consolidated, quantity-summed row inside a station's item roll-up. Voided lines are dropped - a void was never actually going to be served. */
export interface ExpoRollUpItem {
  key: string;
  itemName: string;
  variantName: string | null;
  quantity: number;
}

/** Sums quantity across every non-voided line for the same item+variant at one station, across the station's original fire and any ADD-ON batches - the roll-up doesn't care which batch an item arrived in, only whether it's ready. */
export function rollUpItems(tickets: { lines: TicketLineView[] }[]): ExpoRollUpItem[] {
  const byKey = new Map<string, ExpoRollUpItem>();
  for (const ticket of tickets) {
    for (const line of ticket.lines) {
      if (line.voided) continue;
      const key = `${line.itemId}:${line.variantName ?? ""}`;
      const existing = byKey.get(key);
      if (existing) existing.quantity += line.quantity;
      else byKey.set(key, { key, itemName: line.itemName, variantName: line.variantName, quantity: line.quantity });
    }
  }
  return [...byKey.values()];
}

/** "X of Y ready" - Y is every station the order touches, X is how many of them have every ticket bumped. */
export function readyProgress(order: Pick<ExpoOrderView, "stations">): { ready: number; total: number } {
  return { ready: order.stations.filter((s) => s.ready).length, total: order.stations.length };
}

/** The order's own ageing clock: the firedAt/stationId of its oldest still-queued ticket, across every station. Null once every station is ready - a fully-bumped order has nothing left to age against. */
export function oldestUnbumpedTicket(order: Pick<ExpoOrderView, "stations">): { firedAt: string; stationId: string | null } | null {
  let oldest: { firedAt: string; stationId: string | null } | null = null;
  for (const station of order.stations) {
    for (const ticket of station.tickets) {
      if (ticket.status !== "queued") continue;
      if (!oldest || Date.parse(ticket.firedAt) < Date.parse(oldest.firedAt)) {
        oldest = { firedAt: ticket.firedAt, stationId: ticket.stationId };
      }
    }
  }
  return oldest;
}

/** One row in the Waiting-On panel: a not-yet-bumped, non-voided line plus the order/station context it needs to be readable outside its ticket (SPEC CAP-3: "a Waiting-On panel lists exactly the items not yet bumped"). */
export interface WaitingOnEntry {
  orderId: string;
  tableLabel: string | null;
  tokenNumber: number | null;
  stationId: string | null;
  stationName: string | null;
  firedAt: string;
  line: TicketLineView;
}

/**
 * Flattens every order's authoritative `waitingOn` lines (backend-computed,
 * never re-derived) into panel rows, oldest-first. `waitingOn` itself
 * carries no station name or firedAt (it's just `TicketLineView[]`), so
 * those are looked up from the same order's `stations[].tickets` that
 * produced it - the owning queued ticket is structurally guaranteed to
 * exist (a line can't be in `waitingOn` without one), so a missing owner
 * here is a defensive drop, not an expected case.
 */
export function buildWaitingOnEntries(orders: ExpoOrderView[]): WaitingOnEntry[] {
  const entries: WaitingOnEntry[] = [];
  for (const order of orders) {
    const owners = new Map<string, { stationId: string | null; stationName: string | null; firedAt: string }>();
    for (const station of order.stations) {
      for (const ticket of station.tickets) {
        if (ticket.status !== "queued") continue;
        for (const line of ticket.lines) {
          owners.set(line.id, { stationId: station.stationId, stationName: station.stationName, firedAt: ticket.firedAt });
        }
      }
    }
    for (const line of order.waitingOn) {
      const owner = owners.get(line.id);
      if (!owner) continue;
      entries.push({
        orderId: order.orderId,
        tableLabel: order.tableLabel,
        tokenNumber: order.tokenNumber,
        stationId: owner.stationId,
        stationName: owner.stationName,
        firedAt: owner.firedAt,
        line,
      });
    }
  }
  return entries.sort((a, b) => Date.parse(a.firedAt) - Date.parse(b.firedAt));
}

/** Oldest-fired-order-first - matches K1's `sortOldestFirst` intent (the order that's been waiting longest leads the rail). */
export function sortOrdersOldestFirst(orders: ExpoOrderView[]): ExpoOrderView[] {
  return [...orders].sort((a, b) => {
    const aOldest = oldestUnbumpedTicket(a)?.firedAt ?? earliestTicketFiredAt(a);
    const bOldest = oldestUnbumpedTicket(b)?.firedAt ?? earliestTicketFiredAt(b);
    return Date.parse(aOldest) - Date.parse(bOldest);
  });
}

/** Fallback ordering key for a fully-ready order (no queued ticket left to age against): its earliest ticket overall, so a just-completed order still sorts near where it was queued rather than jumping to whichever end Map iteration happens to land on. */
function earliestTicketFiredAt(order: Pick<ExpoOrderView, "stations">): string {
  let earliest: string | null = null;
  for (const station of order.stations) {
    for (const ticket of station.tickets) {
      if (!earliest || Date.parse(ticket.firedAt) < Date.parse(earliest)) earliest = ticket.firedAt;
    }
  }
  return earliest ?? new Date(0).toISOString();
}
