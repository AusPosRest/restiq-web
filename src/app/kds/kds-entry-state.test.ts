import { describe, expect, it } from "vitest";
import type { StationView } from "./api";
import { resolveEntry, stationOptions, UNROUTED_OPTION } from "./kds-entry-state";

function station(overrides: Partial<StationView>): StationView {
  return { id: "s1", name: "Tandoor", ageingThresholdMinutes: 10, ...overrides };
}

describe("stationOptions", () => {
  it("lists real stations when the outlet has any", () => {
    const stations = [station({ id: "s1", name: "Tandoor" }), station({ id: "s2", name: "Grill" })];
    expect(stationOptions(stations)).toEqual([
      { id: "s1", name: "Tandoor" },
      { id: "s2", name: "Grill" },
    ]);
  });

  it("falls back to the single synthetic unrouted option when there are none", () => {
    expect(stationOptions([])).toEqual([UNROUTED_OPTION]);
  });
});

describe("resolveEntry", () => {
  const stations = [station({ id: "s1", name: "Tandoor" }), station({ id: "s2", name: "Grill" })];

  it("redirects straight to a saved station id that's still valid", () => {
    expect(resolveEntry(stations, "s2")).toEqual({ kind: "redirect", stationId: "s2" });
  });

  it("shows the picker when there is no saved choice", () => {
    expect(resolveEntry(stations, null)).toEqual({ kind: "pick", options: stationOptions(stations) });
  });

  it("falls back to the picker when the saved station no longer exists (e.g. deleted)", () => {
    expect(resolveEntry(stations, "gone")).toEqual({ kind: "pick", options: stationOptions(stations) });
  });

  it("honours a saved 'unrouted' choice only when the outlet truly has zero stations", () => {
    expect(resolveEntry([], "unrouted")).toEqual({ kind: "redirect", stationId: "unrouted" });
    expect(resolveEntry(stations, "unrouted")).toEqual({ kind: "pick", options: stationOptions(stations) });
  });
});
