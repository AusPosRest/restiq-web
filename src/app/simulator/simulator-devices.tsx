"use client";

// The /simulator device list (restiq-web#346, PE-26 / CU-25). Every device
// is its own browser window on its own sim-<id>.localhost origin, so each one
// keeps its own enrolment and its own login. This page only keeps the list:
// open, focus, close or re-open each window, and see which are open.
import { useEffect, useRef, useState } from "react";
import {
  createDevice,
  CUSTOM_DEVICE_SIZE,
  deviceUrl,
  isLocalHostname,
  loadDevices,
  nextLabel,
  PRESETS,
  saveDevices,
  validateCustomPath,
  windowFeatures,
  windowName,
  type DevicePreset,
  type SimDevice,
} from "./simulator-state";

type Origin = { protocol: string; hostname: string; port: string };
type DeviceStatus = "open" | "closed" | "blocked";

const STATUS_TEXT: Record<DeviceStatus, string> = {
  open: "Open",
  closed: "Closed",
  blocked: "Pop-up blocked - allow pop-ups for this page, then press Re-open",
};

const BUTTON = "rounded-md border border-border px-2.5 py-1 text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function SimulatorDevices() {
  const [devices, setDevices] = useState<SimDevice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [status, setStatus] = useState<Record<string, DeviceStatus>>({});
  const [customPath, setCustomPath] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const windows = useRef(new Map<string, Window>());

  // Deferred load so server render and first client render agree (window
  // and localStorage don't exist on the server).
  useEffect(() => {
    const timeout = setTimeout(() => {
      setOrigin({ protocol: window.location.protocol, hostname: window.location.hostname, port: window.location.port });
      setDevices(loadDevices());
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (loaded) saveDevices(devices);
  }, [devices, loaded]);

  // A window closed by hand (or by the device itself) shows as Closed.
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [id, win] of windows.current) {
        if (win.closed) {
          windows.current.delete(id);
          setStatus((current) => ({ ...current, [id]: "closed" }));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function openWindow(device: SimDevice) {
    if (!origin) return;
    const win = window.open(deviceUrl(device.path, device.id, origin), windowName(device.id), windowFeatures(device));
    if (win) {
      windows.current.set(device.id, win);
      win.focus();
    }
    setStatus((current) => ({ ...current, [device.id]: win ? "open" : "blocked" }));
  }

  function addDevice(preset: Pick<DevicePreset, "label" | "path" | "width" | "height">) {
    const device = createDevice({ ...preset, label: nextLabel(devices, preset.label) });
    setDevices((current) => [...current, device]);
    openWindow(device);
  }

  function focusWindow(device: SimDevice) {
    const win = windows.current.get(device.id);
    if (win && !win.closed) win.focus();
    else openWindow(device);
  }

  function closeWindow(id: string) {
    windows.current.get(id)?.close();
    windows.current.delete(id);
    setStatus((current) => ({ ...current, [id]: "closed" }));
  }

  function removeDevice(id: string) {
    closeWindow(id);
    setDevices((current) => current.filter((device) => device.id !== id));
  }

  function handleCustomSubmit() {
    const result = validateCustomPath(customPath);
    if (!result.ok) {
      setCustomError(result.error);
      return;
    }
    addDevice({ label: "Custom", path: result.path, ...CUSTOM_DEVICE_SIZE });
    setCustomPath("");
    setCustomError(null);
  }

  return (
    <div className="ops-theme min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Simulator</h1>
          <p className="text-sm text-muted-foreground">
            Each device opens in its own window and is its own device - enrol it, sign in, and run one order across the owner
            console, the till, the kitchen and the guest&apos;s phone.
          </p>
          {origin && !isLocalHostname(origin.hostname) ? (
            <p data-testid="simulator-shared-note" className="text-sm text-muted-foreground">
              On this address every window shares one sign-in. Open the simulator on localhost for separate devices.
            </p>
          ) : null}
        </header>

        <section aria-labelledby="simulator-add-heading" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 id="simulator-add-heading" className="text-sm font-semibold">
            Add a device
          </h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                data-testid={`simulator-add-${preset.key}`}
                onClick={() => addDevice(preset)}
                className={BUTTON}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="simulator-custom-path" className="text-xs font-medium text-muted-foreground">
              Or open any page of this app
            </label>
            <div className="flex gap-2">
              <input
                id="simulator-custom-path"
                data-testid="simulator-custom-path"
                type="text"
                placeholder="/pos/login"
                value={customPath}
                onChange={(event) => {
                  setCustomPath(event.target.value);
                  setCustomError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleCustomSubmit();
                }}
                className="min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button type="button" data-testid="simulator-custom-add" onClick={handleCustomSubmit} className={BUTTON}>
                Open
              </button>
            </div>
            {customError ? (
              <p role="alert" data-testid="simulator-custom-error" className="text-xs text-error-soft">
                {customError}
              </p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="simulator-devices-heading" className="flex flex-col gap-2">
          <h2 id="simulator-devices-heading" className="text-sm font-semibold">
            Devices
          </h2>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="simulator-empty">
              No devices yet. Add one above.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card" data-testid="simulator-device-list">
              {devices.map((device) => {
                const state = status[device.id] ?? "closed";
                return (
                  <li key={device.id} data-testid={`simulator-device-${device.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{device.label}</span>
                      <span className="text-xs text-muted-foreground" aria-live="polite" data-testid={`simulator-device-status-${device.id}`}>
                        {STATUS_TEXT[state]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {state === "open" ? (
                        <>
                          <button type="button" data-testid={`simulator-device-focus-${device.id}`} onClick={() => focusWindow(device)} className={BUTTON}>
                            Focus
                          </button>
                          <button type="button" data-testid={`simulator-device-close-${device.id}`} onClick={() => closeWindow(device.id)} className={BUTTON}>
                            Close
                          </button>
                        </>
                      ) : (
                        <button type="button" data-testid={`simulator-device-reopen-${device.id}`} onClick={() => openWindow(device)} className={BUTTON}>
                          Re-open
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`simulator-device-remove-${device.id}`}
                        aria-label={`Remove ${device.label}`}
                        onClick={() => removeDevice(device.id)}
                        className={BUTTON}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
