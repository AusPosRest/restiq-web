"use client";

// DESIGN.md's OfflineIndicatorPill. restiq-web#343 (PE-19): reads the
// browser's own connectivity signal (navigator.onLine plus the online/offline
// events) instead of a fixed "Online (demo)" - a production till never shows
// made-up status. Server render assumes online; the client corrects on mount.
// restiq-web#437 (HUB-BUILD-PLAN W2): on a shop hub the pill shows the hub's
// own cloud link and outbox instead, and a lock banner when new sales stop.
import { useSyncExternalStore } from "react";
import { Lock, Wifi, WifiOff } from "lucide-react";
import type { HubStatus } from "../../api";
import { formatDateTime } from "@/lib/datetime";

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

function hubLabel(hub: HubStatus): string {
  if (hub.online) return "Online";
  return `Offline · ${hub.outboxDepth} sale${hub.outboxDepth === 1 ? "" : "s"} waiting to sync`;
}

/** `hub` is the shop hub's status, or null/undefined off a hub (browser connectivity only). */
export function OfflineIndicatorPill({ testId = "pos-connectivity-status-pill", hub }: Readonly<{ testId?: string; hub?: HubStatus | null }>) {
  const browserOnline = useBrowserOnline();
  const online = hub ? hub.online : browserOnline;
  const Icon = online ? Wifi : WifiOff;
  return (
    <span
      data-testid={testId}
      data-online={online}
      data-hub={hub ? true : undefined}
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium ${online ? "text-status-available" : "text-status-alert"}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {hub ? hubLabel(hub) : online ? "Online" : "Offline"}
    </span>
  );
}

/** Red banner while the hub refuses new sales (SYNC-DESIGN §9, D-8). Renders nothing when not locked. */
export function HubLockBanner({ hub }: Readonly<{ hub: HubStatus | null }>) {
  if (!hub?.locked) return null;
  const message =
    hub.lockReason === "revoked"
      ? "This till has been removed by the owner, so it can't save changes. Ask the owner to set it up again."
      : `New sales are paused: this till couldn't sync with the cloud${hub.mustSyncBefore ? ` by ${formatDateTime(hub.mustSyncBefore)}` : ""}. You can still close open bills and print. Reconnect to the internet to unlock.`;
  return (
    <div role="alert" data-testid="pos-hub-lock-banner" data-reason={hub.lockReason ?? undefined} className="flex items-center gap-2 bg-status-alert px-6 py-2 text-sm font-medium text-white">
      <Lock className="size-4 shrink-0" aria-hidden="true" />
      <span data-testid="pos-hub-lock-banner-message">{message}</span>
    </div>
  );
}
