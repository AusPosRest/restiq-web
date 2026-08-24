import { describe, expect, it } from "vitest";
import { clearFilter, DEFAULT_SYNC_HEALTH_QUERY, parseSyncHealthQuery, toApiParams, toUrlParams, withFilter } from "./table-state";

describe("parseSyncHealthQuery", () => {
  it("defaults to no filter", () => {
    expect(parseSyncHealthQuery(new URLSearchParams(""))).toEqual(DEFAULT_SYNC_HEALTH_QUERY);
  });

  it("reads the exact ?filter= values the dashboard alert tiles send", () => {
    expect(parseSyncHealthQuery(new URLSearchParams("filter=silent"))).toEqual({ filter: "silent", tenantId: "" });
    expect(parseSyncHealthQuery(new URLSearchParams("filter=rejections"))).toEqual({ filter: "rejections", tenantId: "" });
  });

  it("ignores an unrecognized filter value", () => {
    expect(parseSyncHealthQuery(new URLSearchParams("filter=bogus"))).toEqual(DEFAULT_SYNC_HEALTH_QUERY);
  });

  it("reads tenantId", () => {
    expect(parseSyncHealthQuery(new URLSearchParams("tenantId=abc"))).toEqual({ filter: "", tenantId: "abc" });
  });
});

describe("toApiParams", () => {
  it("maps a severity filter to ?severity=", () => {
    expect(toApiParams({ filter: "silent", tenantId: "" })).toBe("severity=silent");
    expect(toApiParams({ filter: "lagging", tenantId: "" })).toBe("severity=lagging");
  });

  it("does not forward the client-only rejections filter to the API", () => {
    expect(toApiParams({ filter: "rejections", tenantId: "" })).toBe("");
  });

  it("includes tenantId when set", () => {
    expect(toApiParams({ filter: "silent", tenantId: "t1" })).toBe("tenantId=t1&severity=silent");
  });
});

describe("toUrlParams / withFilter / clearFilter", () => {
  it("round-trips through the URL", () => {
    const query = withFilter(DEFAULT_SYNC_HEALTH_QUERY, "silent");
    expect(toUrlParams(query).toString()).toBe("filter=silent");
    expect(parseSyncHealthQuery(toUrlParams(query))).toEqual(query);
  });

  it("clearFilter removes the filter but keeps tenantId", () => {
    const query = { filter: "silent" as const, tenantId: "t1" };
    expect(clearFilter(query)).toEqual({ filter: "", tenantId: "t1" });
  });
});
