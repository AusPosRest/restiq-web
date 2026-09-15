"use client";

// Device list for the current outlet (name/type/role/app version/last
// seen/status). Enrolment happens through the code chip; removal (issue
// #215) is a per-row Remove that the parent confirms with a reason and
// revokes - the row then stays listed as Revoked for the audit trail.
import { Dialog } from "radix-ui";
import { ExternalLink, MonitorSmartphone, QrCode, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { QR_SIZE_PX, useQrDataUrl } from "../floor-plan/table-qr-dialog";
import { formatLastSeen, type AdminDeviceView } from "./devices-state";

// Where an enrolled device's surface lives, so an owner can click straight
// through to log in and take orders (issue #112). Kiosk/CDS have no web
// surface yet. Mirrors src/app/device/device-state.ts's continueTargetFor -
// not imported across route trees (AD-4). POS carries `?device=&tenant=` so
// the shared PIN pad can bind itself to this device's tenant (issue #150,
// terminal-binding.ts) instead of relying on POS_TENANT_ID.
const SURFACE_LINKS: Record<string, { href: (device: Pick<AdminDeviceView, "id" | "tenantId">) => string; label: string }> = {
  pos: { href: (device) => `/pos/login?device=${encodeURIComponent(device.id)}&tenant=${encodeURIComponent(device.tenantId)}`, label: "Open POS" },
  kds: { href: () => "/kds", label: "Open KDS" },
  // The simulated receipt printer (issue #172) is a POS-realm screen: bind the
  // PIN pad to this device's tenant, then land on /pos/printer after sign-in.
  printer: {
    href: (device) =>
      `/pos/login?device=${encodeURIComponent(device.id)}&tenant=${encodeURIComponent(device.tenantId)}&next=${encodeURIComponent("/pos/printer")}`,
    label: "Open printer",
  },
  // The simulated card terminal (issue #188) is a POS-realm screen too - same
  // bind-then-land shape as the printer above.
  terminal: {
    href: (device) =>
      `/pos/login?device=${encodeURIComponent(device.id)}&tenant=${encodeURIComponent(device.tenantId)}&next=${encodeURIComponent("/pos/terminal")}`,
    label: "Open terminal",
  },
};

const STATUS_LABELS: Record<string, string> = { active: "Enrolled", revoked: "Revoked" };
const STATUS_STYLES: Record<string, string> = {
  active: "border-status-active/50 bg-status-active/10 text-status-active",
  revoked: "border-status-error/50 bg-status-error/10 text-status-error",
};

export interface DevicesTableProps {
  devices: readonly AdminDeviceView[];
  /** Present when the parent can revoke: every enrolled row gets a Remove button. */
  onRemove?: (device: AdminDeviceView) => void;
}

export function DevicesTable({ devices, onRemove }: Readonly<DevicesTableProps>) {
  // Read once at mount, same lazy-initializer escape hatch code-chip.tsx uses
  // for Date.now() - "last seen" doesn't need to live-tick like the
  // enrolment countdown does.
  const [now] = useState(() => Date.now());
  const [qrFor, setQrFor] = useState<AdminDeviceView | null>(null);

  if (devices.length === 0) {
    return (
      <div data-testid="devices-empty" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <MonitorSmartphone className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No devices yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">Enrol a device to bring the first terminal or display online.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
      <table className="w-full text-sm" data-testid="devices-table">
        <thead>
          <tr className="h-12 border-b border-border/40">
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device Name</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">App Version</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Seen</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} data-testid={`devices-row-${device.id}`} className="h-14 border-b border-border/20 last:border-b-0">
              <td className="px-4 font-medium">{device.label}</td>
              <td className="px-4 text-muted-foreground">{device.type.toUpperCase()}</td>
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
              <td className="px-4 text-muted-foreground">{device.appVersion ?? "-"}</td>
              <td className="px-4 text-muted-foreground">{formatLastSeen(device.lastContactAt, now)}</td>
              <td className="px-4">
                <span
                  data-testid={`device-status-${device.id}`}
                  className={`font-label inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[device.status] ?? STATUS_STYLES.revoked}`}
                >
                  {STATUS_LABELS[device.status] ?? device.status}
                </span>
              </td>
              <td className="px-4 text-right">
                {device.status === "active" ? (
                  <div className="inline-flex items-center gap-3">
                    {SURFACE_LINKS[device.type] && (
                      <>
                        <button
                          type="button"
                          aria-label={`Show QR for ${device.label}`}
                          data-testid={`device-qr-${device.id}`}
                          onClick={() => setQrFor(device)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <QrCode className="size-4" aria-hidden="true" />
                        </button>
                        <a
                          href={SURFACE_LINKS[device.type].href(device)}
                          target="_blank"
                          rel="noopener"
                          data-testid={`device-open-${device.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {SURFACE_LINKS[device.type].label}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        data-testid={`device-remove-${device.id}`}
                        aria-label={`Remove ${device.label}`}
                        onClick={() => onRemove(device)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1 text-xs font-semibold text-muted-foreground hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {qrFor && <DeviceQrDialog key={qrFor.id} device={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}

/** Scan-to-open for an already-enrolled device (issue #202): a QR of the same link as the row's "Open …". */
function DeviceQrDialog({ device, onClose }: Readonly<{ device: AdminDeviceView; onClose: () => void }>) {
  const url = `${window.location.origin}${SURFACE_LINKS[device.type].href(device)}`;
  const qrDataUrl = useQrDataUrl(url);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="device-qr-dialog"
          aria-describedby={undefined}
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-headline text-lg font-semibold">{device.label}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              data-testid="device-qr-dialog-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </Dialog.Close>
          </div>
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not something next/image's optimizer can (or needs to) handle
              <img
                data-testid="device-qr-dialog-image"
                src={qrDataUrl}
                alt={`QR to open ${device.label}`}
                width={QR_SIZE_PX}
                height={QR_SIZE_PX}
                className="rounded-md bg-white p-2"
              />
            ) : (
              <div style={{ width: QR_SIZE_PX, height: QR_SIZE_PX }} className="flex items-center justify-center text-xs text-muted-foreground">
                Generating…
              </div>
            )}
            <p className="text-xs text-muted-foreground">Scan with the device&apos;s camera to open its screen</p>
            <code data-testid="device-qr-dialog-url" className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs">
              {url}
            </code>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
