"use client";

import { Store } from "lucide-react";
import { useOutlets } from "./outlet-context";

export function OutletSwitcher() {
  const { outlets, loading, selectedOutletId, selectOutlet } = useOutlets();

  if (loading) return <div className="h-9 w-40 animate-pulse rounded-lg bg-accent" aria-hidden="true" />;
  if (outlets.length === 0) return null;

  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm">
      <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Outlet</span>
      <select
        data-testid="outlet-switcher"
        value={selectedOutletId ?? ""}
        onChange={(event) => selectOutlet(event.target.value)}
        className="bg-transparent focus:outline-none"
      >
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </select>
    </label>
  );
}
