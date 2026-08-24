// URL <-> table state for the device fleet (mirrors the tenant directory's
// DataTable pattern: filter state lives in the URL so views are shareable).
// Pure functions, unit-tested.

export const DEVICE_TYPE_OPTIONS = ["pos", "kds", "kiosk", "cds"] as const;
export const DEVICE_STATUS_OPTIONS = ["active", "revoked"] as const;

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  pos: "POS (Point of Sale)",
  kds: "KDS (Kitchen Display)",
  kiosk: "Kiosk",
  cds: "Customer Display (CDS)",
};

export interface DeviceTableQuery {
  tenantId: string;
  type: string;
  status: string;
  cursor: string;
}

export const DEFAULT_DEVICE_QUERY: DeviceTableQuery = { tenantId: "", type: "", status: "", cursor: "" };

const FILTER_KEYS = ["tenantId", "type", "status"] as const;
export type DeviceFilterKey = (typeof FILTER_KEYS)[number];

function pick(params: URLSearchParams, key: string, allowed?: readonly string[]): string {
  const value = params.get(key) ?? "";
  if (allowed && !allowed.includes(value)) return "";
  return value;
}

export function parseDeviceTableQuery(params: URLSearchParams): DeviceTableQuery {
  return {
    tenantId: pick(params, "tenantId"),
    type: pick(params, "type", DEVICE_TYPE_OPTIONS),
    status: pick(params, "status", DEVICE_STATUS_OPTIONS),
    cursor: pick(params, "cursor"),
  };
}

export function toUrlParams(query: DeviceTableQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (query[key]) params.set(key, query[key]);
  }
  if (query.cursor) params.set("cursor", query.cursor);
  return params;
}

export function toApiParams(query: DeviceTableQuery, limit: number): string {
  const params = toUrlParams(query);
  params.set("limit", String(limit));
  return params.toString();
}

export function withFilter(query: DeviceTableQuery, key: DeviceFilterKey, value: string): DeviceTableQuery {
  return { ...query, [key]: value, cursor: "" };
}

export function clearFilters(): DeviceTableQuery {
  return { ...DEFAULT_DEVICE_QUERY };
}

export function hasFilters(query: DeviceTableQuery): boolean {
  return FILTER_KEYS.some((key) => query[key] !== "");
}

const CHIP_LABELS: Record<DeviceFilterKey, string> = {
  tenantId: "Tenant",
  type: "Type",
  status: "Status",
};

export interface DeviceFilterChip {
  key: DeviceFilterKey;
  label: string;
}

export function filterChips(query: DeviceTableQuery, tenantName?: (id: string) => string | undefined): DeviceFilterChip[] {
  return FILTER_KEYS.filter((key) => query[key] !== "").map((key) => {
    const raw = query[key];
    const value = key === "tenantId" ? (tenantName?.(raw) ?? raw) : key === "type" ? DEVICE_TYPE_LABELS[raw] ?? raw : raw;
    return { key, label: `${CHIP_LABELS[key]}: ${value}` };
  });
}
