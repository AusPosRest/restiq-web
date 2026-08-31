import { describe, expect, it } from "vitest";
import {
  clearFilters,
  DEFAULT_QUERY,
  filterChips,
  hasFilters,
  parseTableQuery,
  toApiParams,
  toUrlParams,
  withFilter,
  withSort,
} from "./table-state";

describe("parseTableQuery", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseTableQuery(new URLSearchParams())).toEqual(DEFAULT_QUERY);
  });

  it("round-trips filters, sort and cursor through the URL", () => {
    const query = parseTableQuery(new URLSearchParams("q=spice&status=active&country=IN&sort=name&order=desc&cursor=abc"));
    expect(query).toMatchObject({ q: "spice", status: "active", country: "IN", sort: "name", order: "desc", cursor: "abc" });
    expect(parseTableQuery(toUrlParams(query))).toEqual(query);
  });

  it("drops unknown filter values instead of sending them to the API", () => {
    const query = parseTableQuery(new URLSearchParams("status=zombie&plan=free&health=meh"));
    expect(query.status).toBe("");
    expect(query.plan).toBe("");
    expect(query.health).toBe("");
  });

  it("defaults order per sort column: createdAt desc, name asc", () => {
    expect(parseTableQuery(new URLSearchParams()).order).toBe("desc");
    expect(parseTableQuery(new URLSearchParams("sort=name")).order).toBe("asc");
  });
});

describe("toUrlParams", () => {
  it("omits defaults so a clean view has a clean URL", () => {
    expect(toUrlParams(DEFAULT_QUERY).toString()).toBe("");
  });

  it("keeps only what deviates", () => {
    const params = toUrlParams({ ...DEFAULT_QUERY, status: "active", sort: "name", order: "desc" });
    expect(params.toString()).toBe("status=active&sort=name&order=desc");
  });
});

describe("toApiParams", () => {
  it("is always explicit about sort, order and limit", () => {
    const params = new URLSearchParams(toApiParams(DEFAULT_QUERY, 25));
    expect(params.get("sort")).toBe("createdAt");
    expect(params.get("order")).toBe("desc");
    expect(params.get("limit")).toBe("25");
  });
});

describe("filter transitions", () => {
  it("withFilter sets the value and resets the cursor", () => {
    const paged = { ...DEFAULT_QUERY, cursor: "page-2" };
    const next = withFilter(paged, "country", "AU");
    expect(next.country).toBe("AU");
    expect(next.cursor).toBe("");
  });

  it("clearFilters keeps the sort but drops every filter and the cursor", () => {
    const query = { ...DEFAULT_QUERY, q: "x", plan: "standard", sort: "name" as const, order: "desc" as const, cursor: "c" };
    expect(clearFilters(query)).toEqual({ ...DEFAULT_QUERY, sort: "name", order: "desc" });
  });

  it("withSort flips order on the active column and resets it for a new one", () => {
    expect(withSort(DEFAULT_QUERY, "createdAt").order).toBe("asc");
    expect(withSort(DEFAULT_QUERY, "name")).toMatchObject({ sort: "name", order: "asc", cursor: "" });
  });
});

describe("chips", () => {
  it("derives one removable chip per active filter", () => {
    const query = { ...DEFAULT_QUERY, q: "spice", health: "unknown" };
    expect(hasFilters(query)).toBe(true);
    expect(filterChips(query)).toEqual([
      { key: "q", label: "Search: spice" },
      { key: "health", label: "Health: unknown" },
    ]);
    expect(filterChips(DEFAULT_QUERY)).toEqual([]);
    expect(hasFilters(DEFAULT_QUERY)).toBe(false);
  });
});
