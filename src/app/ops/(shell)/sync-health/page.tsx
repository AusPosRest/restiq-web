import { Activity } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function OpsSyncHealthPage() {
  return (
    <ComingSoon
      title="Sync Health"
      description="Per-outlet sync lag, outbox depth and silence alerts arrive with the sync-health story."
      icon={Activity}
      testId="ops-sync-health-placeholder"
    />
  );
}
