// Pure entry-flow logic for the /kds station picker (EXPERIENCE.md:
// "station picker (which station's queue is this display showing?) plus
// Expo/Bumped/All-Day as peer choices... persists per browser"). Kept free
// of React/localStorage/fetch so the decision of "redirect straight to the
// saved station" vs "show the picker" is unit-testable without a DOM,
// mirroring pin-login-state.ts's split between logic and UI.
import type { StationView } from "./api";

/** One selectable entry in the picker - a real Station, or the synthetic "unrouted" grouping when the outlet has zero stations (restiq-backend#70: tickets fire to `stationId: null` rather than failing when there's nothing to route to). */
export type StationOption = { id: string; name: string };

export const UNROUTED_OPTION: StationOption = { id: "unrouted", name: "Unrouted tickets" };

/** The picker's option list: real stations normally, or the single synthetic option when there are none - never both, since "unrouted" only exists as a queue when no real station could have been picked. */
export function stationOptions(stations: StationView[]): StationOption[] {
  if (stations.length === 0) return [UNROUTED_OPTION];
  return stations.map((station) => ({ id: station.id, name: station.name }));
}

export type EntryDecision = { kind: "redirect"; stationId: string } | { kind: "pick"; options: StationOption[] };

/**
 * A saved station id only short-circuits the picker if it's still a valid
 * choice for this outlet (the station wasn't since deleted, and "unrouted"
 * only if the outlet still has zero stations) - otherwise falls through to
 * the picker rather than redirecting to a queue that no longer exists.
 */
export function resolveEntry(stations: StationView[], savedStationId: string | null): EntryDecision {
  const options = stationOptions(stations);
  if (savedStationId && options.some((option) => option.id === savedStationId)) {
    return { kind: "redirect", stationId: savedStationId };
  }
  return { kind: "pick", options };
}
