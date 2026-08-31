// URL <-> table state for the dead-letter queue (O9). Mirrors the device
// fleet's DataTable pattern: filter state lives in the URL so a pre-filtered
// cross-link (?tenantId=&deviceId=) is shareable/bookmarkable and matches the
// same param names the rest of the console already uses.
// Pure functions, unit-tested.

export const REASON_CODE_OPTIONS = ["clock_skew", "stale_price_version", "schema_skew", "device_revoked"] as const;

export const REASON_CODE_LABELS: Record<string, string> = {
  clock_skew: "Clock skew",
  stale_price_version: "Stale price version",
  schema_skew: "Schema skew",
  device_revoked: "Device revoked",
};

export interface DlqTableQuery {
  tenantId: string;
  deviceId: string;
  reasonCode: string;
  cursor: string;
}

export const DEFAULT_DLQ_QUERY: DlqTableQuery = { tenantId: "", deviceId: "", reasonCode: "", cursor: "" };

const FILTER_KEYS = ["tenantId", "deviceId", "reasonCode"] as const;
export type DlqFilterKey = (typeof FILTER_KEYS)[number];

function pick(params: URLSearchParams, key: string): string {
  return params.get(key) ?? "";
}

export function parseDlqQuery(params: URLSearchParams): DlqTableQuery {
  return {
    tenantId: pick(params, "tenantId"),
    deviceId: pick(params, "deviceId"),
    reasonCode: pick(params, "reasonCode"),
    cursor: pick(params, "cursor"),
  };
}

export function toUrlParams(query: DlqTableQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (query[key]) params.set(key, query[key]);
  }
  if (query.cursor) params.set("cursor", query.cursor);
  return params;
}

export function toApiParams(query: DlqTableQuery, limit: number): string {
  const params = toUrlParams(query);
  params.set("limit", String(limit));
  return params.toString();
}

export function withFilter(query: DlqTableQuery, key: DlqFilterKey, value: string): DlqTableQuery {
  return { ...query, [key]: value, cursor: "" };
}

export function clearFilters(): DlqTableQuery {
  return { ...DEFAULT_DLQ_QUERY };
}

export function hasFilters(query: DlqTableQuery): boolean {
  return FILTER_KEYS.some((key) => query[key] !== "");
}

const CHIP_LABELS: Record<DlqFilterKey, string> = {
  tenantId: "Tenant",
  deviceId: "Device",
  reasonCode: "Reason",
};

export interface DlqFilterChip {
  key: DlqFilterKey;
  label: string;
}

export function filterChips(
  query: DlqTableQuery,
  tenantName?: (id: string) => string | undefined,
  deviceLabel?: (id: string) => string | undefined,
): DlqFilterChip[] {
  return FILTER_KEYS.filter((key) => query[key] !== "").map((key) => {
    const raw = query[key];
    const value = key === "tenantId" ? (tenantName?.(raw) ?? raw) : key === "deviceId" ? (deviceLabel?.(raw) ?? raw) : raw;
    return { key, label: `${CHIP_LABELS[key]}: ${value}` };
  });
}

/** Bulk-replay-by-filter body: the set filter fields only, same shape the list query already sends. */
export function toBulkFilter(query: DlqTableQuery): { tenantId?: string; deviceId?: string; reasonCode?: string } {
  return {
    ...(query.tenantId && { tenantId: query.tenantId }),
    ...(query.deviceId && { deviceId: query.deviceId }),
    ...(query.reasonCode && { reasonCode: query.reasonCode }),
  };
}
