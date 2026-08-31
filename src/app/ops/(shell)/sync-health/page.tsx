import { Suspense } from "react";
import { SyncHealthTable } from "./sync-health-table";

export default function OpsSyncHealthPage() {
  return (
    <Suspense>
      <SyncHealthTable />
    </Suspense>
  );
}
