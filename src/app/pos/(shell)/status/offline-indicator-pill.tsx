"use client";

// DESIGN.md's OfflineIndicatorPill. restiq-web#343 (PE-19): reads the
// browser's own connectivity signal (navigator.onLine plus the online/offline
// events) instead of a fixed "Online (demo)" - a production till never shows
// made-up status. Server render assumes online; the client corrects on mount.
import { useSyncExternalStore } from "react";
import { Wifi, WifiOff } from "lucide-react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useBrowserOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineIndicatorPill({ testId = "pos-connectivity-status-pill" }: Readonly<{ testId?: string }>) {
  const online = useBrowserOnline();
  const Icon = online ? Wifi : WifiOff;
  return (
    <span
      data-testid={testId}
      data-online={online}
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium ${online ? "text-status-available" : "text-status-alert"}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {online ? "Online" : "Offline"}
    </span>
  );
}
