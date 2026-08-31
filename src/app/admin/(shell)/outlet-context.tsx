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
  selectedOutletId: string | null;
  selectOutlet: (id: string) => void;
}

const OutletContext = createContext<OutletContextValue | null>(null);

export function OutletProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [outlets, setOutlets] = useState<OutletView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOutlets()
      .then((result) => {
        if (cancelled) return;
        setOutlets(result);
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const initial = result.find((outlet) => outlet.id === stored)?.id ?? result[0]?.id ?? null;
        setSelectedOutletId(initial);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectOutlet = useCallback((id: string) => {
    setSelectedOutletId(id);
    sessionStorage.setItem(STORAGE_KEY, id);
  }, []);

  return <OutletContext.Provider value={{ outlets, loading, selectedOutletId, selectOutlet }}>{children}</OutletContext.Provider>;
}

export function useOutlets(): OutletContextValue {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useOutlets must be used inside OutletProvider");
  return ctx;
}
