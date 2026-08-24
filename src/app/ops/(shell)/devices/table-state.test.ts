import { describe, expect, it } from "vitest";
import {
  clearFilters,
  DEFAULT_DEVICE_QUERY,
  filterChips,
  hasFilters,
  parseDeviceTableQuery,
  toApiParams,
  toUrlParams,
  withFilter,
} from "./table-state";

describe("parseDeviceTableQuery", () => {
  it("defaults to no filters", () => {
    expect(parseDeviceTableQuery(new URLSearchParams(""))).toEqual(DEFAULT_DEVICE_QUERY);
  });

  it("reads known filters and drops unknown values", () => {
    const query = parseDeviceTableQuery(new URLSearchParams("type=pos&status=revoked&tenantId=abc"));
    expect(query).toEqual({ tenantId: "abc", type: "pos", status: "revoked", cursor: "" });

    expect(parseDeviceTableQuery(new URLSearchParams("type=printer")).type).toBe("");
    expect(parseDeviceTableQuery(new URLSearchParams("status=deleted")).status).toBe("");
  });
});

describe("toUrlParams / toApiParams", () => {
  it("omits empty filters from the URL", () => {
    expect(toUrlParams(DEFAULT_DEVICE_QUERY).toString()).toBe("");
    expect(toUrlParams({ ...DEFAULT_DEVICE_QUERY, type: "kds" }).toString()).toBe("type=kds");
  });

  it("always includes limit for the API call", () => {
    expect(toApiParams(DEFAULT_DEVICE_QUERY, 25)).toBe("limit=25");
    expect(toApiParams({ ...DEFAULT_DEVICE_QUERY, status: "active" }, 25)).toBe("status=active&limit=25");
  });
});

describe("withFilter", () => {
  it("sets a filter and resets the cursor", () => {
    const next = withFilter({ ...DEFAULT_DEVICE_QUERY, cursor: "xyz" }, "type", "pos");
    expect(next).toEqual({ tenantId: "", type: "pos", status: "", cursor: "" });
  });
});

describe("hasFilters / clearFilters", () => {
  it("detects any active filter and clears back to defaults", () => {
    expect(hasFilters(DEFAULT_DEVICE_QUERY)).toBe(false);
    expect(hasFilters({ ...DEFAULT_DEVICE_QUERY, status: "revoked" })).toBe(true);
    expect(clearFilters()).toEqual(DEFAULT_DEVICE_QUERY);
  });
});

describe("filterChips", () => {
  it("labels each active filter, resolving a tenant name when given", () => {
    const query = { tenantId: "t1", type: "pos", status: "active", cursor: "" };
    const chips = filterChips(query, (id) => (id === "t1" ? "Spice Route" : undefined));
    expect(chips).toEqual([
      { key: "tenantId", label: "Tenant: Spice Route" },
      { key: "type", label: "Type: POS (Point of Sale)" },
      { key: "status", label: "Status: active" },
    ]);
  });

  it("falls back to the raw id when the tenant name is unknown", () => {
    const chips = filterChips({ ...DEFAULT_DEVICE_QUERY, tenantId: "t9" });
    expect(chips).toEqual([{ key: "tenantId", label: "Tenant: t9" }]);
  });
});
