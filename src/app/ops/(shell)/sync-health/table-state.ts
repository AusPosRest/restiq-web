// URL <-> table state for Sync Health (O8). `filter` is the exact query
// param the dashboard's alert tiles already send (?filter=silent,
// ?filter=rejections) - reused as-is rather than inventing a second name.
// Pure functions, unit-tested.

export const SEVERITY_FILTERS = ["healthy", "lagging", "silent"] as const;
export type SeverityFilter = (typeof SEVERITY_FILTERS)[number];
export const FILTER_VALUES = [...SEVERITY_FILTERS, "rejections"] as const;
export type FilterValue = (typeof FILTER_VALUES)[number];

export interface SyncHealthQuery {
  filter: FilterValue | "";
  tenantId: string;
}

export const DEFAULT_SYNC_HEALTH_QUERY: SyncHealthQuery = { filter: "", tenantId: "" };

export const FILTER_LABELS: Record<FilterValue, string> = {
  healthy: "Healthy",
  lagging: "Lagging",
  silent: "Silent",
  rejections: "Has rejections",
};

export function parseSyncHealthQuery(params: URLSearchParams): SyncHealthQuery {
  const rawFilter = params.get("filter") ?? "";
  const filter = (FILTER_VALUES as readonly string[]).includes(rawFilter) ? (rawFilter as FilterValue) : "";
  return { filter, tenantId: params.get("tenantId") ?? "" };
}

export function toUrlParams(query: SyncHealthQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.filter) params.set("filter", query.filter);
  if (query.tenantId) params.set("tenantId", query.tenantId);
  return params;
}

/** Query params sent to GET /ops/v1/sync-health: severity filters server-side, "rejections" is applied client-side. */
export function toApiParams(query: SyncHealthQuery): string {
  const params = new URLSearchParams();
  if (query.tenantId) params.set("tenantId", query.tenantId);
  if ((SEVERITY_FILTERS as readonly string[]).includes(query.filter)) params.set("severity", query.filter);
  return params.toString();
}

export function withFilter(query: SyncHealthQuery, filter: SyncHealthQuery["filter"]): SyncHealthQuery {
  return { ...query, filter };
}

export function clearFilter(query: SyncHealthQuery): SyncHealthQuery {
  return { ...query, filter: "" };
}
