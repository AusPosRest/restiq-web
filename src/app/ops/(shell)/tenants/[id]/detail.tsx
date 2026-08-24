"use client";

// O5 Tenant Detail: tab-bar page over the detail aggregate. Every mutation
// goes through the confirm-modal-with-required-reason; the status badge
// reflects lifecycle changes immediately.
import { ChevronRight, Rocket } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, TenantDetail } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { StatusBadge } from "../../status-badge";
import { useToast } from "../../toast";
import { useOpsLoad } from "../../use-ops-load";
import { CapabilitiesTab } from "./capabilities-tab";
import { BrandingTab, OutletsTab, OverviewTab, OwnersTab, SubscriptionTab } from "./tabs";

const TABS = ["overview", "outlets", "subscription", "capabilities", "branding", "owners"] as const;
export type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  outlets: "Outlets",
  subscription: "Subscription",
  capabilities: "Capabilities",
  branding: "Branding",
  owners: "Owners",
};

export function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const tabParam = searchParams.get("tab");
  const tab: TabKey = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabKey) : "overview";

  const { loading, failed, data, retry: load } = useOpsLoad<TenantDetail>(`tenants/${params.id}`);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);

  function selectTab(next: TabKey) {
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`);
  }

  async function activate(reason: string) {
    setActivateBusy(true);
    try {
      await opsApi(`tenants/${params.id}/activate`, { method: "POST", body: JSON.stringify({ reason }) });
      setActivateOpen(false);
      toast({ kind: "success", message: "Tenant activated." });
      load();
    } catch (error) {
      toast({
        kind: "error",
        message: error instanceof OpsApiError ? error.message : "Activation failed.",
      });
    } finally {
      setActivateBusy(false);
    }
  }

  if (loading) {
    return (
      <section data-testid="tenant-detail-loading">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-8 w-80" />
        <Skeleton className="mt-6 h-10 w-full max-w-2xl" />
        <Skeleton className="mt-6 h-48 w-full" />
      </section>
    );
  }

  if (failed || !data) {
    return <LoadErrorPanel message="This tenant could not be loaded." onRetry={load} testId="tenant-detail-error" />;
  }

  const detail = data;
  const { tenant } = detail;
  const gstin = detail.taxRegistrations[0];

  return (
    <section data-testid="tenant-detail">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/ops/tenants"
          className="rounded-md px-1 py-0.5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tenants
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground">{tenant.name}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-2xl font-semibold">{tenant.name}</h1>
            <StatusBadge status={tenant.status} testId="tenant-detail-status" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {tenant.country === "IN" ? "India" : "Australia"}
            {gstin && (
              <>
                {" · "}
                {gstin.registrationType.toUpperCase()} {gstin.registrationNumber}
              </>
            )}
            {" · Onboarded "}
            {new Date(tenant.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        {tenant.status === "provisioning" && (
          <Button data-testid="tenant-activate" onClick={() => setActivateOpen(true)}>
            <Rocket aria-hidden="true" /> Activate tenant
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Tenant sections" className="mt-6 flex gap-1 border-b border-border/40">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            data-testid={`tenant-tab-${key}`}
            onClick={() => selectTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === key
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab detail={detail} onMutated={load} />}
        {tab === "outlets" && <OutletsTab detail={detail} />}
        {tab === "subscription" && <SubscriptionTab detail={detail} />}
        {tab === "capabilities" && <CapabilitiesTab tenantId={tenant.id} capabilities={detail.capabilities} />}
        {tab === "branding" && <BrandingTab detail={detail} onMutated={load} />}
        {tab === "owners" && <OwnersTab detail={detail} onMutated={load} />}
      </div>

      <ConfirmReasonDialog
        open={activateOpen}
        title={`Activate ${tenant.name}`}
        description="The tenant moves from provisioning to active and its owner surfaces go live."
        verb="Activate tenant"
        busy={activateBusy}
        onCancel={() => setActivateOpen(false)}
        onConfirm={(reason) => void activate(reason)}
      />
    </section>
  );
}
