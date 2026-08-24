import { Suspense } from "react";
import { TenantDetailPage } from "./detail";

export default function OpsTenantDetailRoute() {
  return (
    <Suspense>
      <TenantDetailPage />
    </Suspense>
  );
}
