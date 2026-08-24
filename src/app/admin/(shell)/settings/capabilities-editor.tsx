"use client";

// T10 Capabilities tab (CAP-10): per-outlet toggles (QR ordering, kiosk,
// token queue, ...), scoped by the same outlet switcher the rest of the
// shell's per-outlet screens use (EXPERIENCE.md IA: "Floor Plan (per-outlet;
// outlet switcher scopes it)" - Capabilities is the same shape). There is no
// outlet-management screen anywhere in this build yet (CAP-4's wiki notes
// the same gap for per-outlet menu overrides), so a tenant with zero outlets
// gets an informational empty state rather than a dead-end action button.
import { Store, ToggleLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchOutletCapabilities } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { capabilityDescription, capabilityLabel, KNOWN_CAPABILITY_KEYS, mergeCapabilities, OutletCapabilityView } from "./capability-state";
import { CapabilityToggle } from "./capability-toggle";

function LoadingRows() {
  return (
    <div className="space-y-3" data-testid="capabilities-loading">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  );
}

export function CapabilitiesEditor() {
  const { outlets, loading: outletsLoading, selectedOutletId } = useOutlets();

  if (outletsLoading) return <LoadingRows />;

  if (outlets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center" data-testid="capabilities-no-outlets">
        <Store className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No outlets yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Once your outlets are set up, their capability toggles will show up here.</p>
      </div>
    );
  }

  if (!selectedOutletId) return <LoadingRows />;

  // key={selectedOutletId}: a full remount on outlet switch, rather than an
  // effect resetting the optimistic-overlay state - so a toggle in flight
  // for outlet A can never bleed into outlet B's list.
  return <OutletCapabilities key={selectedOutletId} outletId={selectedOutletId} />;
}

interface Landed {
  attempt: number;
  value: OutletCapabilityView[] | null;
  failed: boolean;
}

// Same landed/attempt loading shape as use-admin-load.ts, just fetching by
// outletId instead of a fixed path.
function useOutletCapabilitiesLoad(outletId: string) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOutletCapabilities(outletId)
      .then((value) => {
        if (!cancelled) setLanded({ attempt, value, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, value: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [outletId, attempt]);

  const current = landed && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current && !current.failed ? current.value : null,
    retry: () => setAttempt((n) => n + 1),
  };
}

function OutletCapabilities({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, data, retry } = useOutletCapabilitiesLoad(outletId);

  if (loading) return <LoadingRows />;
  if (failed) return <LoadErrorPanel testId="capabilities-load-error" message="Capabilities couldn't be loaded." onRetry={retry} />;

  // The backend only returns rows that have been explicitly toggled at
  // least once - render every known capability, defaulting an absent one to
  // disabled, so a fresh outlet still shows something togglable instead of
  // an empty list with no way to ever turn a capability on.
  return <CapabilitiesList outletId={outletId} initial={mergeCapabilities(KNOWN_CAPABILITY_KEYS, data ?? [])} />;
}

// Owns the optimistic-toggle overlay, seeded once from the load that's
// already landed by the time this mounts (see the key={selectedOutletId}
// remount above for why no effect is needed to keep it in sync).
function CapabilitiesList({ outletId, initial }: Readonly<{ outletId: string; initial: OutletCapabilityView[] }>) {
  const [capabilities, setCapabilities] = useState<OutletCapabilityView[]>(initial);

  function handleChanged(key: string, next: boolean) {
    setCapabilities((current) => current.map((c) => (c.key === key ? { ...c, enabled: next } : c)));
  }

  if (capabilities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center" data-testid="capabilities-empty">
        <ToggleLeft className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No capabilities configured</p>
        <p className="max-w-md text-sm text-muted-foreground">This outlet has no capability toggles set up yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/40 rounded-lg border border-border/40 bg-card" data-testid="capabilities-list">
      {capabilities.map((capability) => (
        <li key={capability.key} className="flex items-center justify-between gap-4 px-5 py-4" data-testid={`capability-row-${capability.key}`}>
          <div>
            <p className="text-sm font-medium">{capabilityLabel(capability.key)}</p>
            {capabilityDescription(capability.key) && <p className="mt-0.5 text-xs text-muted-foreground">{capabilityDescription(capability.key)}</p>}
          </div>
          <CapabilityToggle
            outletId={outletId}
            capabilityKey={capability.key}
            label={capabilityLabel(capability.key)}
            enabled={capability.enabled}
            onChanged={(next) => handleChanged(capability.key, next)}
          />
        </li>
      ))}
    </ul>
  );
}
