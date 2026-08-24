import { Store } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function OpsTenantsPage() {
  return (
    <ComingSoon
      title="Tenants"
      description="The tenant directory, detail view and onboarding wizard arrive with the tenant-directory and onboarding stories."
      icon={Store}
      testId="ops-tenants-placeholder"
    />
  );
}
