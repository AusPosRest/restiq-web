"use client";

// Entry step (EXPERIENCE.md: "PIN login -> station picker -> K1"). Fetches
// the outlet's stations, checks the per-browser saved choice
// (kds-station-storage.ts), and either redirects straight into that
// station's queue or renders the picker. `?reselect=1` (set by the header's
// "Change station" control - see (shell)/kds-header.tsx) forces the picker
// even when a saved choice exists.
import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listStations } from "./api";
import { useKdsLoad } from "./use-kds-load";
import { useKdsOutlet } from "./kds-outlet-context";
import { getSavedStationId, saveStationId } from "./kds-station-storage";
import { resolveEntry, stationOptions, type StationOption } from "./kds-entry-state";
import { LoadErrorPanel, Skeleton } from "./data-states";

export function KdsEntry() {
  const outlet = useKdsOutlet();
  const router = useRouter();
  const forceReselect = useSearchParams().get("reselect") === "1";
  // useCallback keeps this stable across renders (unless outlet.id itself
  // changes) - useKdsLoad's effect depends on the loader function, and an
  // inline lambda recreated every render would re-fetch in a loop.
  const loadStations = useCallback(() => listStations(outlet.id), [outlet.id]);
  const { loading, failed, data: stations, retry } = useKdsLoad(`outlets/${outlet.id}/stations`, loadStations);

  const decision = stations && !forceReselect ? resolveEntry(stations, getSavedStationId(outlet.id)) : null;

  useEffect(() => {
    if (decision?.kind === "redirect") router.replace(`/kds/station/${encodeURIComponent(decision.stationId)}`);
  }, [decision, router]);

  function pick(option: StationOption) {
    saveStationId(outlet.id, option.id);
    router.replace(`/kds/station/${encodeURIComponent(option.id)}`);
  }

  const options = stations ? stationOptions(stations) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <p className="font-headline text-2xl font-bold tracking-tight text-primary">{outlet.name}</p>
        <h1 className="mt-2 font-headline text-lg font-semibold text-foreground">Choose this display&apos;s station</h1>
      </div>

      {loading && (
        <div data-testid="kds-entry-loading" className="grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {!loading && failed && <LoadErrorPanel testId="kds-entry-load-error" message="Couldn't load stations for this outlet." onRetry={retry} />}

      {!loading && !failed && options && decision?.kind !== "redirect" && (
        <div data-testid="kds-entry-picker" className="grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`kds-station-option-${option.id}`}
              onClick={() => pick(option)}
              className="flex min-h-14 items-center justify-center rounded-lg border border-border bg-card px-4 py-6 text-center text-base font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
