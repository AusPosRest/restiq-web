import { Suspense } from "react";
import { TenantsTable } from "./tenants-table";

export default function OpsTenantsPage() {
  return (
    <Suspense>
      <TenantsTable />
    </Suspense>
  );
}
