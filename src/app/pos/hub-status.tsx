"use client";

// Shop hub status for every signed-in /pos page (HUB-BUILD-PLAN W2/W3,
// restiq-web#437). The POS layout owns the ONE poller; the lock banner sits
// above every screen (selling screens included), and HubStatusStrip (pill +
// Sync issues link) goes in the shift bar and the table-map/counter header.
// Off a hub (404) the context stays null and nothing visible changes. The PIN
// pad doesn't poll. The Sync issues link shows only once hub/rejections
// answers: the hub checks `settle_bills` (D-7); the POS has no permission list.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudAlert } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { listHubRejections, type HubStatus } from "./api";
import { HubLockBanner, OfflineIndicatorPill } from "./(shell)/status/offline-indicator-pill";
import { useHubStatus } from "./(shell)/status/use-hub-status";
import { POS_LOGIN_PATH } from "@/lib/pos-session";

interface HubContext {
  hub: HubStatus | null;
  canSeeSyncIssues: boolean;
}

const Hub = createContext<HubContext>({ hub: null, canSeeSyncIssues: false });

export function HubStatusProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const hub = useHubStatus(usePathname() !== POS_LOGIN_PATH);
  const onHub = hub !== null;
  const [canSeeSyncIssues, setCanSeeSyncIssues] = useState(false);

  useEffect(() => {
    if (!onHub) return;
    let cancelled = false;
    void listHubRejections()
      .then(() => !cancelled && setCanSeeSyncIssues(true))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [onHub]);

  return (
    <Hub.Provider value={{ hub, canSeeSyncIssues }}>
      <HubLockBanner hub={hub} />
      {children}
    </Hub.Provider>
  );
}

/** Connectivity pill, plus the Sync issues link on a hub for staff the hub lets read them. */
export function HubStatusStrip({ pillTestId }: Readonly<{ pillTestId?: string }>) {
  const { hub, canSeeSyncIssues } = useContext(Hub);
  const open = hub ? hub.rejections + hub.orphans : 0;
  return (
    <>
      <OfflineIndicatorPill testId={pillTestId} hub={hub} />
      {hub && canSeeSyncIssues && (
        <Link
          href="/pos/sync-issues"
          data-testid="pos-shift-bar-sync-issues-link"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloudAlert className="size-3.5" aria-hidden="true" /> Sync issues
          {open > 0 && (
            <span data-testid="pos-shift-bar-sync-issues-count" className="rounded-full bg-status-alert px-1.5 text-[10px] font-semibold text-white">
              {open}
            </span>
          )}
        </Link>
      )}
    </>
  );
}
