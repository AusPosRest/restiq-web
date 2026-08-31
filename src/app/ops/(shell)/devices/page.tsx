import { Suspense } from "react";
import { DevicesTable } from "./devices-table";

export default function OpsDevicesPage() {
  return (
    <Suspense>
      <DevicesTable />
    </Suspense>
  );
}
