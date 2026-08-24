// URL <-> table state for the tenant directory (EXPERIENCE.md DataTable
// pattern: sort/filter/pagination state lives in the URL so views are
// shareable). Pure functions, unit-tested.

export const STATUS_OPTIONS = ["provisioning", "active"] as const;
export const COUNTRY_OPTIONS = ["IN", "AU"] as const;
export const PLAN_OPTIONS = ["standard", "enterprise"] as const;
export const HEALTH_OPTIONS = ["healthy", "lagging", "silent", "unknown"] as const;

export interface TableQuery {
  q: string;
  status: string;
  country: string;
  plan: string;
  health: string;
  sort: "createdAt" | "name";
  order: "asc" | "desc";
  cursor: string;
}

export const DEFAULT_QUERY: TableQuery = {
  q: "",
  status: "",
  country: "",
  plan: "",
  health: "",
  sort: "createdAt",
  order: "desc",
  cursor: "",
};

const FILTER_KEYS = ["q", "status", "country", "plan", "health"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

function pick(params: URLSearchParams, key: string, allowed?: readonly string[]): string {
  const value = params.get(key) ?? "";
  if (allowed && !allowed.includes(value)) return "";
  return value;
}

export function parseTableQuery(params: URLSearchParams): TableQuery {
  const sort = params.get("sort") === "name" ? "name" : "createdAt";
  const orderParam = params.get("order");
  return {
    q: pick(params, "q"),
    status: pick(params, "status", STATUS_OPTIONS),
    country: pick(params, "country", COUNTRY_OPTIONS),
    plan: pick(params, "plan", PLAN_OPTIONS),
    health: pick(params, "health", HEALTH_OPTIONS),
    sort,
    order: orderParam === "asc" || orderParam === "desc" ? orderParam : sort === "name" ? "asc" : "desc",
    cursor: pick(params, "cursor"),
  };
}

/** Serialize for the address bar - defaults are omitted so clean URLs stay clean. */
export function toUrlParams(query: TableQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (query[key]) params.set(key, query[key]);
  }
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
  const defaultOrder = query.sort === "name" ? "asc" : "desc";
  if (query.order !== defaultOrder) params.set("order", query.order);
  if (query.cursor) params.set("cursor", query.cursor);
  return params;
}

/** Serialize for the API call (always explicit about sort + order). */
export function toApiParams(query: TableQuery, limit: number): string {
  const params = toUrlParams(query);
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("limit", String(limit));
  return params.toString();
}

/** A filter change means a new result set - the cursor never survives it. */
export function withFilter(query: TableQuery, key: FilterKey, value: string): TableQuery {
  return { ...query, [key]: value, cursor: "" };
}

export function clearFilters(query: TableQuery): TableQuery {
  return { ...DEFAULT_QUERY, sort: query.sort, order: query.order };
}

/** Clicking a sorted column flips it; a new column starts at its natural order. */
export function withSort(query: TableQuery, sort: TableQuery["sort"]): TableQuery {
  const order: TableQuery["order"] =
    query.sort === sort ? (query.order === "asc" ? "desc" : "asc") : sort === "name" ? "asc" : "desc";
  return { ...query, sort, order, cursor: "" };
}

export function hasFilters(query: TableQuery): boolean {
  return FILTER_KEYS.some((key) => query[key] !== "");
}

const CHIP_LABELS: Record<FilterKey, string> = {
  q: "Search",
  status: "Status",
  country: "Country",
  plan: "Plan",
  health: "Health",
};

export interface FilterChip {
  key: FilterKey;
  label: string;
}

export function filterChips(query: TableQuery): FilterChip[] {
  return FILTER_KEYS.filter((key) => query[key] !== "").map((key) => ({
    key,
    label: `${CHIP_LABELS[key]}: ${query[key]}`,
  }));
}
