"use client";

// CAP-4 device fleet: fleet-wide when no tenantId prop is given, tenant-
// scoped when Tenant Detail's Devices tab passes one. Same five-state
// DataTable pattern as the tenant directory (EXPERIENCE.md).
import { Info, MonitorSmartphone, Plus, Radio, ShieldOff } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeviceListItem, DeviceListResult, DeviceView, opsApi, OpsApiError, TenantListResult } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { StatusBadge } from "../status-badge";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";
import { GenerateCodeDialog, TenantOption } from "./generate-code-dialog";
import {
  clearFilters,
  DEVICE_STATUS_OPTIONS,
  DEVICE_TYPE_LABELS,
  DEVICE_TYPE_OPTIONS,
  filterChips,
  hasFilters,
  parseDeviceTableQuery,
  toApiParams,
  toUrlParams,
  withFilter,
} from "./table-state";

const PAGE_SIZE = 25;

const SELECT_CLASSES =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface DevicesTableProps {
  tenantId?: string;
  tenantName?: string;
  tenantOutlets?: Array<{ id: string; name: string }>;
}

export function DevicesTable({ tenantId: fixedTenantId, tenantName, tenantOutlets }: Readonly<DevicesTableProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const query = parseDeviceTableQuery(new URLSearchParams(searchParams.toString()));
  const effectiveTenantId = fixedTenantId ?? query.tenantId;

  const { loading, failed, data, retry } = useOpsLoad<DeviceListResult>(
    `devices?${toApiParams({ ...query, tenantId: effectiveTenantId }, PAGE_SIZE)}`,
  );
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [hubTarget, setHubTarget] = useState<DeviceListItem | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<DeviceListItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (fixedTenantId) return;
    void opsApi<TenantListResult>("tenants?limit=100&sort=name&order=asc").then((res) =>
      setTenants(res.tenants.map((tenant) => ({ id: tenant.id, name: tenant.name }))),
    );
  }, [fixedTenantId]);

  function navigate(next: typeof query) {
    const params = toUrlParams(next).toString();
    router.replace(params ? `${pathname}?${params}` : pathname);
  }

  const tenantNameById = (id: string) => tenants.find((tenant) => tenant.id === id)?.name;
  const chips = fixedTenantId ? [] : filterChips(query, tenantNameById);
  const filtered = fixedTenantId ? false : hasFilters(query);

  const priorHubFor = (device: DeviceListItem) =>
    data?.devices.find((row) => row.outletId === device.outletId && row.role === "hub" && row.status === "active" && row.id !== device.id) ??
    null;

  async function confirmHub(reason: string) {
    if (!hubTarget) return;
    setActionBusy(true);
    try {
      const res = await opsApi<{ device: DeviceView; displacedDeviceId: string | null }>(`devices/${hubTarget.id}/hub`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      });
      setHubTarget(null);
      toast({
        kind: "success",
        message: res.displacedDeviceId
          ? `${hubTarget.label} is now the outlet hub - the previous hub moved to Terminal.`
          : `${hubTarget.label} is now the outlet hub.`,
      });
      retry();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not designate this device as hub." });
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmRevoke(reason: string) {
    if (!revokeTarget) return;
    setActionBusy(true);
    try {
      await opsApi(`devices/${revokeTarget.id}/revoke`, { method: "POST", body: JSON.stringify({ reason }) });
      setRevokeTarget(null);
      toast({ kind: "success", message: `${revokeTarget.label} has been revoked.` });
      retry();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not revoke this device." });
    } finally {
      setActionBusy(false);
    }
  }

  const priorHub = hubTarget ? priorHubFor(hubTarget) : null;

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Devices</h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="devices-count">
              {data.total} device{data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <Button data-testid="devices-generate-code" onClick={() => setGenerateOpen(true)}>
          <Plus aria-hidden="true" /> Generate code
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-border/40 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {!fixedTenantId && (
            <select
              data-testid="devices-filter-tenant"
              aria-label="Tenant"
              value={query.tenantId}
              onChange={(event) => navigate(withFilter(query, "tenantId", event.target.value))}
              className={SELECT_CLASSES}
            >
              <option value="">Tenant: All</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          )}
          <select
            data-testid="devices-filter-type"
            aria-label="Type"
            value={query.type}
            onChange={(event) => navigate(withFilter(query, "type", event.target.value))}
            className={SELECT_CLASSES}
          >
            <option value="">Type: All</option>
            {DEVICE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {DEVICE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            data-testid="devices-filter-status"
            aria-label="Status"
            value={query.status}
            onChange={(event) => navigate(withFilter(query, "status", event.target.value))}
            className={SELECT_CLASSES}
          >
            <option value="">Status: All</option>
            {DEVICE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="devices-filter-chips">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-[6px] border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
              >
                {chip.label}
              </span>
            ))}
            <button
              type="button"
              data-testid="devices-clear-filters"
              onClick={() => navigate(clearFilters())}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {failed ? (
          <div className="p-4">
            <LoadErrorPanel message="The device list could not be loaded." onRetry={retry} testId="devices-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="devices-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                {!fixedTenantId && (
                  <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tenant &amp; Outlet
                  </th>
                )}
                {fixedTenantId && (
                  <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outlet</th>
                )}
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "devices-loading" : undefined}>
                    {Array.from({ length: 6 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                data?.devices.map((device) => (
                  <tr key={device.id} data-testid={`devices-row-${device.id}`} className="h-14 border-b border-border/20 last:border-b-0">
                    <td className="px-4 font-medium">{device.label}</td>
                    <td className="px-4 text-muted-foreground">{device.type.toUpperCase()}</td>
                    {!fixedTenantId && (
                      <td className="px-4 text-muted-foreground">
                        {device.tenantName}
                        {device.outletName && <span className="block text-xs">{device.outletName}</span>}
                      </td>
                    )}
                    {fixedTenantId && <td className="px-4 text-muted-foreground">{device.outletName ?? "-"}</td>}
                    <td className="px-4">
                      {device.role === "hub" ? (
                        <span
                          data-testid={`device-role-${device.id}`}
                          className="inline-flex items-center gap-1 rounded-[6px] border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary"
                        >
                          <Radio className="size-3" aria-hidden="true" /> Hub
                        </span>
                      ) : (
                        <span data-testid={`device-role-${device.id}`} className="text-xs text-muted-foreground">
                          Terminal
                        </span>
                      )}
                    </td>
                    <td className="px-4">
                      <StatusBadge status={device.status} testId={`device-status-${device.id}`} />
                    </td>
                    <td className="px-4">
                      <div className="flex justify-end gap-2">
                        {device.status === "active" && device.role !== "hub" && device.outletId && (
                          <Button
                            variant="secondary"
                            size="sm"
                            data-testid={`device-hub-${device.id}`}
                            onClick={() => setHubTarget(device)}
                          >
                            <Radio aria-hidden="true" /> Designate hub
                          </Button>
                        )}
                        {device.status === "active" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            data-testid={`device-revoke-${device.id}`}
                            className="text-status-critical hover:bg-status-critical/10"
                            onClick={() => setRevokeTarget(device)}
                          >
                            <ShieldOff aria-hidden="true" /> Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {!loading && data && data.devices.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <MonitorSmartphone className="size-8 text-muted-foreground" aria-hidden="true" />
            {filtered ? (
              <div data-testid="devices-filtered-empty">
                <p className="font-headline text-lg font-medium">No results for these filters</p>
                <Button variant="secondary" size="sm" className="mt-3" data-testid="devices-filtered-empty-clear" onClick={() => navigate(clearFilters())}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div data-testid="devices-empty">
                <p className="font-headline text-lg font-medium">No devices yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Generate an enrolment code to bring the first device online.</p>
                <Button size="sm" className="mt-3" data-testid="devices-empty-generate" onClick={() => setGenerateOpen(true)}>
                  <Plus aria-hidden="true" /> Generate code
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && data && (data.nextCursor || query.cursor) && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {query.cursor && (
            <Button variant="secondary" size="sm" data-testid="devices-first-page" onClick={() => navigate({ ...query, cursor: "" })}>
              First page
            </Button>
          )}
          {data.nextCursor && (
            <Button
              variant="secondary"
              size="sm"
              data-testid="devices-next-page"
              onClick={() => navigate({ ...query, cursor: data.nextCursor ?? "" })}
            >
              Next
            </Button>
          )}
        </div>
      )}

      <GenerateCodeDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        tenants={tenants}
        fixedTenant={fixedTenantId && tenantName ? { id: fixedTenantId, name: tenantName, outlets: tenantOutlets ?? [] } : undefined}
      />

      <ConfirmReasonDialog
        open={hubTarget !== null}
        title={`Designate ${hubTarget?.label ?? ""} as hub`}
        description={
          priorHub ? (
            <>
              <strong>{priorHub.label}</strong> is currently the hub for this outlet and will be moved to Terminal. Hub role is
              always assigned explicitly - never auto-elected.
            </>
          ) : (
            `${hubTarget?.label ?? "This device"} becomes the outlet's hub.`
          )
        }
        verb="Designate hub"
        busy={actionBusy}
        onCancel={() => setHubTarget(null)}
        onConfirm={(reason) => void confirmHub(reason)}
      />

      <ConfirmReasonDialog
        open={revokeTarget !== null}
        title={`Revoke device ${revokeTarget?.label ?? ""}?`}
        destructive
        description={
          <>
            <div
              data-testid="revoke-dlq-warning"
              className="mb-3 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-foreground"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Any operations queued for this device will be routed to the Dead-Letter Queue for review - nothing will be lost.</span>
            </div>
            Revoking takes effect immediately - the device can no longer sync.
          </>
        }
        verb="Revoke device"
        busy={actionBusy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={(reason) => void confirmRevoke(reason)}
      />
    </section>
  );
}
