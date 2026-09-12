"use client";

// T6 Devices & Printers (CAP-6): per-outlet, scoped by the shell's outlet
// switcher - same key={selectedOutletId} remount shape as Floor Plan/
// Settings/Capabilities so an edit in flight for outlet A can never bleed
// into outlet B.
import { MonitorSmartphone, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchDevices, fetchFloorPlan } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { CodeChip } from "./code-chip";
import { DevicesTable } from "./devices-table";
import { GenerateCodeDialog } from "./generate-code-dialog";
import { PrinterConfigPanel } from "./printer-config-panel";
import { Topology } from "./topology";
import type { AdminDeviceView, EnrolmentCodeResult } from "./devices-state";
import type { PrinterView, StationView } from "../floor-plan/floor-plan-state";

export function Devices() {
  const { outlets, loading: outletsLoading, selectedOutletId } = useOutlets();

  if (outletsLoading) return <LoadingShell />;

  if (outlets.length === 0) {
    return (
      <div data-testid="devices-no-outlets" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <MonitorSmartphone className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No outlets yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Once your outlets are set up, you can enrol devices and configure printers here.</p>
      </div>
    );
  }

  if (!selectedOutletId) return <LoadingShell />;

  return <OutletDevices key={selectedOutletId} outletId={selectedOutletId} />;
}

function LoadingShell() {
  return (
    <div className="space-y-4" data-testid="devices-loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
    </div>
  );
}

interface DevicesData {
  devices: AdminDeviceView[];
  printers: PrinterView[];
  stations: StationView[];
}

function useDevicesData(outletId: string) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<{ attempt: number; data: DevicesData | null; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDevices(outletId), fetchFloorPlan(outletId)])
      .then(([devices, floorPlan]) => {
        if (!cancelled) setLanded({ attempt, failed: false, data: { devices, printers: floorPlan.printers, stations: floorPlan.stations } });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, failed: true, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [outletId, attempt]);

  const current = landed && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current?.data ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

function OutletDevices({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, data, retry } = useDevicesData(outletId);

  if (loading) return <LoadingShell />;
  if (failed) return <LoadErrorPanel testId="devices-load-error" message="Devices and printers couldn't be loaded." onRetry={retry} />;
  if (!data) return null;

  return <DevicesEditor outletId={outletId} initial={data} />;
}

// The topology's online dots follow the devices' 30 s heartbeat (issue #210).
const DEVICES_REFRESH_MS = 30_000;

// Devices (table, enrolment code, printer config) and Topology (the map) as
// two tabs (issue #212) - all state lives in DevicesEditor so switching is
// instant and never drops an active code or an in-flight link. Same
// role=tablist idiom as /ops's Tenant Detail; ponytail: no URL param.
const VIEWS = [
  { key: "devices", label: "Devices" },
  { key: "topology", label: "Topology" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

function DevicesEditor({ outletId, initial }: Readonly<{ outletId: string; initial: DevicesData }>) {
  const [devices, setDevices] = useState<AdminDeviceView[]>(initial.devices);
  const [now, setNow] = useState(() => Date.now());
  const [printers, setPrinters] = useState<PrinterView[]>(initial.printers);
  const [stations, setStations] = useState<StationView[]>(initial.stations);
  const [activeCode, setActiveCode] = useState<EnrolmentCodeResult | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [view, setView] = useState<ViewKey>("devices");

  useEffect(() => {
    const id = setInterval(() => {
      // A failed refresh keeps the last known list - the next tick retries.
      fetchDevices(outletId)
        .then((next) => {
          setDevices(next);
          setNow(Date.now());
        })
        .catch(() => undefined);
    }, DEVICES_REFRESH_MS);
    return () => clearInterval(id);
  }, [outletId]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">POS and KDS devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage active terminals and displays</p>
        </div>
        <Button data-testid="devices-generate-code" onClick={() => setGenerateOpen(true)}>
          <Plus aria-hidden="true" /> Enrol device
        </Button>
      </div>

      <div role="tablist" aria-label="Device views" className="flex gap-1 border-b border-border/40">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            data-testid={`devices-tab-${key}`}
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              view === key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "topology" && (
        <Topology
          outletId={outletId}
          devices={devices}
          now={now}
          onLinked={(deviceId, posDeviceId) => setDevices((current) => current.map((d) => (d.id === deviceId ? { ...d, pairedPosId: posDeviceId } : d)))}
        />
      )}

      {view === "devices" && (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <DevicesTable devices={devices} />
          {activeCode ? (
            <CodeChip key={activeCode.code} code={activeCode.code} expiresAt={activeCode.expiresAt} onRegenerate={() => setGenerateOpen(true)} />
          ) : (
            <div data-testid="devices-no-active-code" className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 p-5 text-center text-sm text-muted-foreground">
              No active enrolment code. Enrol a device to generate one.
            </div>
          )}
        </div>
      )}

      {view === "devices" && (
        <PrinterConfigPanel
          outletId={outletId}
          printers={printers}
          stations={stations}
          onPrinterUpdated={(saved) => setPrinters((current) => current.map((p) => (p.id === saved.id ? saved : p)))}
          onStationUpdated={(saved) => setStations((current) => current.map((s) => (s.id === saved.id ? saved : s)))}
        />
      )}

      <GenerateCodeDialog open={generateOpen} onClose={() => setGenerateOpen(false)} outletId={outletId} onGenerated={setActiveCode} />
    </div>
  );
}
