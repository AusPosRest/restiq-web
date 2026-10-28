"use client";

// Outlet switcher (EXPERIENCE.md IA: sidebar carries the tenant name + outlet
// switcher; Interaction Primitives: "Outlet switcher persists selection
// across navigation within a session"). sessionStorage, not a URL param -
// the outlet scopes per-outlet menu overrides but isn't itself shareable state.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchOutlets } from "../api";
import type { OutletView } from "./menu/menu-state";

const STORAGE_KEY = "admin.selectedOutletId";

interface OutletContextValue {
  outlets: OutletView[];
  loading: boolean;
  /** The outlet list failed to load - screens show an error with retry, not the "No outlets yet" empty state. */
  failed: boolean;
  reload: () => void;
  selectedOutletId: string | null;
  selectOutlet: (id: string) => void;
  /** Applies a just-saved patch locally so e.g. the outlet switcher reflects a renamed outlet without a refetch. */
  updateOutlet: (id: string, patch: Partial<Pick<OutletView, "name" | "address" | "timezone">>) => void;
}

const OutletContext = createContext<OutletContextValue | null>(null);

export function OutletProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [outlets, setOutlets] = useState<OutletView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOutlets()
      .then((result) => {
        if (cancelled) return;
        setFailed(false);
        setOutlets(result);
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const initial = result.find((outlet) => outlet.id === stored)?.id ?? result[0]?.id ?? null;
        setSelectedOutletId(initial);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const selectOutlet = useCallback((id: string) => {
    setSelectedOutletId(id);
    sessionStorage.setItem(STORAGE_KEY, id);
  }, []);

  const updateOutlet = useCallback((id: string, patch: Partial<Pick<OutletView, "name" | "address" | "timezone">>) => {
    setOutlets((current) => current.map((outlet) => (outlet.id === id ? { ...outlet, ...patch } : outlet)));
  }, []);

  return <OutletContext.Provider value={{ outlets, loading, failed, reload, selectedOutletId, selectOutlet, updateOutlet }}>{children}</OutletContext.Provider>;
}

export function useOutlets(): OutletContextValue {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useOutlets must be used inside OutletProvider");
  return ctx;
}

/** The tenant's currency (INR/AUD, PE-10), read off the outlet list; INR until it loads or outside the provider. */
export function useTenantCurrency(): string {
  return useContext(OutletContext)?.outlets[0]?.currency ?? "INR";
}

/** The selected outlet's IANA timezone, or undefined (viewer's zone) outside the provider or before outlets load. */
export function useSelectedTimezone(): string | undefined {
  const ctx = useContext(OutletContext);
  return ctx?.outlets.find((outlet) => outlet.id === ctx.selectedOutletId)?.timezone;
}
