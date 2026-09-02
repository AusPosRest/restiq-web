"use client";

// Read-only device list for the current outlet (name/type/role/app version/
// last seen/status) - enrolment and revocation stay Platform Console's job;
// this screen only surfaces what's already enrolled plus generates codes.
import { ExternalLink, MonitorSmartphone, Radio } from "lucide-react";
import { useState } from "react";
import { formatLastSeen, type AdminDeviceView } from "./devices-state";

// Where an enrolled device's surface lives, so an owner can click straight
// through to log in and take orders (issue #112). Kiosk/CDS have no web
// surface yet. Mirrors src/app/device/device-state.ts's continueTargetFor -
// not imported across route trees (AD-4).
const SURFACE_LINKS: Record<string, { href: string; label: string }> = {
  pos: { href: "/pos/login", label: "Open POS" },
  kds: { href: "/kds", label: "Open KDS" },
};

const STATUS_LABELS: Record<string, string> = { active: "Enrolled", revoked: "Revoked" };
const STATUS_STYLES: Record<string, string> = {
  active: "border-status-active/50 bg-status-active/10 text-status-active",
  revoked: "border-status-error/50 bg-status-error/10 text-status-error",
};

export function DevicesTable({ devices }: Readonly<{ devices: readonly AdminDeviceView[] }>) {
  // Read once at mount, same lazy-initializer escape hatch code-chip.tsx uses
  // for Date.now() - "last seen" doesn't need to live-tick like the
  // enrolment countdown does.
  const [now] = useState(() => Date.now());

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
                {device.status === "active" && SURFACE_LINKS[device.type] ? (
                  <a
                    href={SURFACE_LINKS[device.type].href}
                    target="_blank"
                    rel="noopener"
                    data-testid={`device-open-${device.id}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {SURFACE_LINKS[device.type].label}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
