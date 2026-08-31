import { afterEach, describe, expect, it } from "vitest";
import { clearSavedStationId, getSavedStationId, saveStationId } from "./kds-station-storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("kds station storage", () => {
  it("returns null when nothing is saved", () => {
    expect(getSavedStationId("outlet-1")).toBeNull();
  });

  it("round-trips a saved station id", () => {
    saveStationId("outlet-1", "s1");
    expect(getSavedStationId("outlet-1")).toBe("s1");
  });

  it("scopes the saved choice per outlet", () => {
    saveStationId("outlet-1", "s1");
    saveStationId("outlet-2", "s2");
    expect(getSavedStationId("outlet-1")).toBe("s1");
    expect(getSavedStationId("outlet-2")).toBe("s2");
  });

  it("clears a saved choice", () => {
    saveStationId("outlet-1", "s1");
    clearSavedStationId("outlet-1");
    expect(getSavedStationId("outlet-1")).toBeNull();
  });
});
