// ExpoOrderRow (DESIGN.md) - one order re-consolidated across every station
// it touched (SPEC CAP-3: "an order with tickets on two stations shows as
// one expo entry whose per-station readiness is visible"). Reuses K1's
// ageing frame/elapsed-clock/order-type/ticket-number logic (station-queue-
// state.ts) rather than re-deriving it - this row's own ageing clock is just
// `ageingLevel` run against the order's oldest still-queued ticket instead
// of a single ticket's.
//
// A station chip's readiness is the real `ExpoStationEntryView.ready` flag
// (every ticket at that station bumped) - there is no per-item ready state
// in the API, so an item's row never claims a state finer than its
// station's. Color never stands alone here either (EXPERIENCE.md
// Accessibility Floor): "Ready"/"Cooking" is always the word on the chip,
// green/amber is the reinforcement, not the only signal.
import { CheckCircle2, Clock } from "lucide-react";
import { ageingLevel, formatElapsed, orderTypeLabel, ticketDisplayNumber, type AgeingLevel } from "../station/station-queue-state";
import { oldestUnbumpedTicket, readyProgress, rollUpItems } from "./expo-state";
import type { ExpoOrderView } from "../../api";

const FRAME_CLASSES: Record<AgeingLevel, string> = {
  new: "border-ticket-new bg-ticket-new/10",
  ageing: "border-ticket-ageing bg-ticket-ageing/10",
  urgent: "border-ticket-urgent bg-ticket-urgent/10",
};

export function ExpoOrderRow({
  order,
  ageingThresholdMinutesFor,
  nowMs,
}: Readonly<{
  order: ExpoOrderView;
  /** Resolves a station id (or null, the unrouted grouping) to its configured ageing threshold - same `?? 10` defensive default station-queue-screen.tsx uses. */
  ageingThresholdMinutesFor: (stationId: string | null) => number;
  nowMs: number;
}>) {
  const oldest = oldestUnbumpedTicket(order);
  const level = oldest ? ageingLevel(oldest.firedAt, ageingThresholdMinutesFor(oldest.stationId), nowMs) : null;
  const { ready, total } = readyProgress(order);
  const allReady = total > 0 && ready === total;

  return (
    <article
      data-testid={`kds-expo-order-${order.orderId}`}
      data-ready={allReady}
      className={`flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border-2 bg-card ${allReady ? "border-ticket-bumped bg-ticket-bumped/10" : FRAME_CLASSES[level ?? "new"]}`}
    >
      <header className="flex items-start justify-between gap-2 px-3 pt-3">
        <div>
          <p data-testid={`kds-expo-order-${order.orderId}-number`} className="font-headline text-xl font-bold text-foreground">
            {ticketDisplayNumber(order)}
          </p>
          <p className="text-xs text-muted-foreground">
            {orderTypeLabel(order)}
          </p>
        </div>
        {oldest ? (
          <p data-testid={`kds-expo-order-${order.orderId}-elapsed`} className="flex items-center gap-1 font-headline text-2xl font-bold tabular-nums text-foreground">
            <Clock className="size-4" aria-hidden="true" />
            {formatElapsed(oldest.firedAt, nowMs)}
          </p>
        ) : (
          <p data-testid={`kds-expo-order-${order.orderId}-elapsed`} className="flex items-center gap-1 text-sm font-bold text-ticket-bumped">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Ready
          </p>
        )}
      </header>

      <div className="flex-1 space-y-3 px-3 py-3">
        {order.stations.map((station) => {
          const stationKey = station.stationId ?? "unrouted";
          const items = rollUpItems(station.tickets);
          return (
            <div key={stationKey} data-testid={`kds-expo-order-${order.orderId}-station-${stationKey}`}>
              <p
                data-testid={`kds-expo-order-${order.orderId}-station-${stationKey}-chip`}
                data-ready={station.ready}
                className={`mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase ${station.ready ? "text-ticket-bumped" : "text-muted-foreground"}`}
              >
                {station.ready ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Clock className="size-3.5" aria-hidden="true" />}
                {station.stationName ?? "Unrouted"} - {station.ready ? "Ready" : "Cooking"}
              </p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.key} data-testid={`kds-expo-order-${order.orderId}-item-${item.key}`} className="flex items-baseline gap-2 text-sm text-foreground">
                    <span className="font-headline font-bold tabular-nums">{item.quantity}</span>
                    <span className="flex-1">
                      {item.itemName}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p data-testid={`kds-expo-order-${order.orderId}-progress`} className={`px-3 pb-3 text-sm font-semibold ${allReady ? "text-ticket-bumped" : "text-muted-foreground"}`}>
        {ready} of {total} ready
      </p>
    </article>
  );
}
