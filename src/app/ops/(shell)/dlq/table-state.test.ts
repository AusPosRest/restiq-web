import { describe, expect, it } from "vitest";
import {
  clearFilters,
  DEFAULT_DLQ_QUERY,
  filterChips,
  hasFilters,
  parseDlqQuery,
  toApiParams,
  toBulkFilter,
  toUrlParams,
  withFilter,
} from "./table-state";

describe("parseDlqQuery", () => {
  it("defaults to no filters", () => {
    expect(parseDlqQuery(new URLSearchParams(""))).toEqual(DEFAULT_DLQ_QUERY);
  });

  it("reads tenantId, deviceId and reasonCode from the URL - the convention a pre-filtered cross-link sends", () => {
    const query = parseDlqQuery(new URLSearchParams("tenantId=t1&deviceId=d1&reasonCode=clock_skew"));
    expect(query).toEqual({ tenantId: "t1", deviceId: "d1", reasonCode: "clock_skew", cursor: "" });
  });
});

describe("toUrlParams / toApiParams", () => {
  it("omits empty filters from the URL", () => {
    expect(toUrlParams(DEFAULT_DLQ_QUERY).toString()).toBe("");
    expect(toUrlParams({ ...DEFAULT_DLQ_QUERY, reasonCode: "schema_skew" }).toString()).toBe("reasonCode=schema_skew");
  });

  it("always includes limit for the API call", () => {
    expect(toApiParams(DEFAULT_DLQ_QUERY, 25)).toBe("limit=25");
    expect(toApiParams({ ...DEFAULT_DLQ_QUERY, tenantId: "t1" }, 25)).toBe("tenantId=t1&limit=25");
  });
});

describe("withFilter", () => {
  it("sets a filter and resets the cursor", () => {
    const next = withFilter({ ...DEFAULT_DLQ_QUERY, cursor: "xyz" }, "reasonCode", "clock_skew");
    expect(next).toEqual({ tenantId: "", deviceId: "", reasonCode: "clock_skew", cursor: "" });
  });
});

describe("hasFilters / clearFilters", () => {
  it("detects any active filter and clears back to defaults", () => {
    expect(hasFilters(DEFAULT_DLQ_QUERY)).toBe(false);
    expect(hasFilters({ ...DEFAULT_DLQ_QUERY, deviceId: "d1" })).toBe(true);
    expect(clearFilters()).toEqual(DEFAULT_DLQ_QUERY);
  });
});

describe("filterChips", () => {
  it("labels each active filter, resolving tenant/device names when given", () => {
    const query = { tenantId: "t1", deviceId: "d1", reasonCode: "clock_skew", cursor: "" };
    const chips = filterChips(
      query,
      (id) => (id === "t1" ? "Spice Route" : undefined),
      (id) => (id === "d1" ? "Terminal 1" : undefined),
    );
    expect(chips).toEqual([
      { key: "tenantId", label: "Tenant: Spice Route" },
      { key: "deviceId", label: "Device: Terminal 1" },
      { key: "reasonCode", label: "Reason: clock_skew" },
    ]);
  });

  it("falls back to the raw id when a name is unknown", () => {
    const chips = filterChips({ ...DEFAULT_DLQ_QUERY, tenantId: "t9" });
    expect(chips).toEqual([{ key: "tenantId", label: "Tenant: t9" }]);
  });
});

describe("toBulkFilter", () => {
  it("carries only the set filter fields, ready to spread into the bulk-replay body", () => {
    expect(toBulkFilter(DEFAULT_DLQ_QUERY)).toEqual({});
    expect(toBulkFilter({ tenantId: "t1", deviceId: "", reasonCode: "clock_skew", cursor: "x" })).toEqual({
      tenantId: "t1",
      reasonCode: "clock_skew",
    });
  });
});
