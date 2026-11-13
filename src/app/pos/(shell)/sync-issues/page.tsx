import { SyncIssuesScreen } from "./sync-issues-screen";

// Sync issues (HUB-BUILD-PLAN W3, restiq-web#437): only reachable from the
// shift bar on a shop hub; the hub itself gates the list on `settle_bills` (D-7).
export default function PosSyncIssuesPage() {
  return <SyncIssuesScreen />;
}
