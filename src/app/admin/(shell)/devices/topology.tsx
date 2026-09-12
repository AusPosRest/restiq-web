"use client";

// Device topology (issue #210 / restiq-backend#134): which printer and card
// terminal each POS at this outlet uses, and whether each device is on. A
// printer/terminal linked to a POS serves only that POS (receipts and card
// payments are routed to it); unlinked ones are shared by the whole outlet.
import { Cable, CreditCard, Monitor, Printer as PrinterIcon } from "lucide-react";
import { useState } from "react";
import { AdminApiError, setDevicePairing } from "../../api";
import { useToast } from "../toast";
import { connectionState, formatLastSeen, type AdminDeviceView, type ConnectionState } from "./devices-state";

const PERIPHERAL_TYPES = ["printer", "terminal"] as const;
const TYPE_NAMES: Record<string, string> = {
  pos: "POS",
  printer: "Printer",
  terminal: "Card terminal",
  kds: "Kitchen display",
  cds: "Customer display",
  kiosk: "Kiosk",
};
const DOT_STYLES: Record<ConnectionState, string> = {
  online: "bg-status-active",
  offline: "bg-status-error",
  never: "bg-muted-foreground/40",
};
const DOT_LABELS: Record<ConnectionState, string> = { online: "Online", offline: "Offline", never: "Never connected" };

interface TopologyProps {
  outletId: string;
  devices: readonly AdminDeviceView[];
  now: number;
  onLinked: (deviceId: string, posDeviceId: string | null) => void;
}

export function Topology({ outletId, devices, now, onLinked }: Readonly<TopologyProps>) {
  const active = devices.filter((device) => device.status === "active");
  const posDevices = active.filter((device) => device.type === "pos");
  const posIds = new Set(posDevices.map((pos) => pos.id));
  const peripherals = active.filter((device) => (PERIPHERAL_TYPES as readonly string[]).includes(device.type));
  const shared = peripherals.filter((device) => !device.pairedPosId || !posIds.has(device.pairedPosId));
  const others = active.filter((device) => device.type !== "pos" && !(PERIPHERAL_TYPES as readonly string[]).includes(device.type));

  const chip = (device: AdminDeviceView) => (
    <PeripheralChip key={device.id} outletId={outletId} device={device} posDevices={posDevices} now={now} onLinked={onLinked} />
  );

  return (
    <section data-testid="topology" className="rounded-lg border border-border/40 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-lg font-semibold">Topology</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Which printer and card terminal each POS uses. A linked device serves only its POS. Status refreshes every 30 seconds.
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Status legend">
          {(Object.keys(DOT_LABELS) as ConnectionState[]).map((state) => (
            <li key={state} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${DOT_STYLES[state]}`} aria-hidden="true" /> {DOT_LABELS[state]}
            </li>
          ))}
        </ul>
      </div>

      {posDevices.length === 0 ? (
        <p data-testid="topology-no-pos" className="mt-4 rounded-md border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No POS enrolled at this outlet yet. Printers and card terminals serve the whole outlet until one is.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {posDevices.map((pos) => (
            <div key={pos.id} data-testid={`topology-pos-${pos.id}`} className="rounded-lg border border-border/60 bg-background p-4">
              <DeviceHeading device={pos} now={now} />
              <ul className="ml-2 mt-3 space-y-2 border-l border-border/60 pl-4">
                {PERIPHERAL_TYPES.map((type) => {
                  const linked = peripherals.find((device) => device.type === type && device.pairedPosId === pos.id);
                  return (
                    <li key={type} className="relative before:absolute before:-left-4 before:top-5 before:h-px before:w-3 before:bg-border/60">
                      {linked ? (
                        chip(linked)
                      ) : (
                        <p data-testid={`topology-pos-${pos.id}-${type}-shared`} className="py-2 text-xs text-muted-foreground">
                          {TYPE_NAMES[type]}: uses the outlet&apos;s shared {type === "printer" ? "printer" : "card terminal"}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div data-testid="topology-shared" className="mt-5">
        <h3 className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shared with the whole outlet</h3>
        {shared.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Every printer and card terminal is linked to a POS.</p>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{shared.map(chip)}</div>
        )}
      </div>

      {others.length > 0 && (
        <div data-testid="topology-others" className="mt-5">
          <h3 className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other devices</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((device) => (
              <div key={device.id} data-testid={`topology-device-${device.id}`} className="rounded-md border border-border/60 bg-background px-3 py-2">
                <DeviceHeading device={device} now={now} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DeviceIcon({ type }: Readonly<{ type: string }>) {
  const Icon = type === "printer" ? PrinterIcon : type === "terminal" ? CreditCard : type === "pos" ? Monitor : Cable;
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function DeviceHeading({ device, now }: Readonly<{ device: AdminDeviceView; now: number }>) {
  const state = connectionState(device.lastContactAt, now);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <DeviceIcon type={device.type} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{device.label}</p>
        <p className="text-xs text-muted-foreground">
          {TYPE_NAMES[device.type] ?? device.type} · {formatLastSeen(device.lastContactAt, now)}
        </p>
      </div>
      <span
        data-testid={`topology-status-${device.id}`}
        data-state={state}
        title={DOT_LABELS[state]}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span className={`size-2.5 rounded-full ${DOT_STYLES[state]}`} aria-hidden="true" />
        <span className="sr-only">{DOT_LABELS[state]}</span>
      </span>
    </div>
  );
}

function PeripheralChip({
  outletId,
  device,
  posDevices,
  now,
  onLinked,
}: Readonly<{ outletId: string; device: AdminDeviceView; posDevices: readonly AdminDeviceView[]; now: number; onLinked: TopologyProps["onLinked"] }>) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function link(posDeviceId: string | null) {
    setBusy(true);
    try {
      await setDevicePairing(outletId, device.id, posDeviceId);
      onLinked(device.id, posDeviceId);
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't change what this device is linked to." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid={`topology-device-${device.id}`} className="rounded-md border border-border/60 bg-background px-3 py-2">
      <DeviceHeading device={device} now={now} />
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        Linked to
        <select
          data-testid={`topology-link-select-${device.id}`}
          value={device.pairedPosId ?? ""}
          disabled={busy}
          onChange={(event) => void link(event.target.value || null)}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">Whole outlet</option>
          {posDevices.map((pos) => (
            <option key={pos.id} value={pos.id}>
              {pos.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
