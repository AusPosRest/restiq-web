import { Plus, Store } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "../coming-soon";

export default function OpsTenantsPage() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="absolute right-0 top-0">
        <Button asChild data-testid="ops-tenants-new">
          <Link href="/ops/tenants/new">
            <Plus aria-hidden="true" /> New tenant
          </Link>
        </Button>
      </div>
      <ComingSoon
        title="Tenants"
        description="The tenant directory and detail view arrive with the tenant-directory story. Onboarding is live - provision a tenant with the New tenant button."
        icon={Store}
        testId="ops-tenants-placeholder"
      />
    </div>
  );
}
