"use client";

// O5 Tenant Detail: tab-bar page over the detail aggregate. Every mutation
// goes through the confirm-modal-with-required-reason; the status badge
// reflects lifecycle changes immediately.
import { ChevronRight, PauseCircle, PlayCircle, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { TestModeBadge } from "@/components/test-mode-badge";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, TenantDetail } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { StatusBadge } from "../../status-badge";
import { useToast } from "../../toast";
import { useOpsLoad } from "../../use-ops-load";
import { DevicesTable } from "../../devices/devices-table";
import { CapabilitiesTab } from "./capabilities-tab";
import { AgreementsTab } from "./agreements-tab";
import { SubscriptionTab } from "./subscription-tab";
import { OutletsTab, OverviewTab, OwnersTab } from "./tabs";

// Branding is the owner's job (Settings > Branding); ops no longer edits it (walkthrough cut).
const TABS = ["overview", "outlets", "devices", "subscription", "capabilities", "owners", "agreements"] as const;
export type TabKey = (typeof TABS)[number];

type LifecycleAction = "activate" | "deactivate" | "reactivate" | "delete";

const LIFECYCLE_SUCCESS: Record<LifecycleAction, string> = {
  activate: "Tenant activated.",
  deactivate: "Tenant deactivated.",
  reactivate: "Tenant reactivated.",
  delete: "Tenant deleted.",
};

const LIFECYCLE_FAILURE: Record<LifecycleAction, string> = {
  activate: "Activation failed.",
  deactivate: "Deactivation failed.",
  reactivate: "Reactivation failed.",
  delete: "Deletion failed.",
};

const LIFECYCLE_DIALOG: Record<
  LifecycleAction,
  { title: (name: string) => string; description: string; verb: string }
> = {
  activate: {
    title: (name) => `Activate ${name}`,
    description: "The tenant moves from provisioning to active. It also goes live by itself on its first sale, or when the owner presses Go live.",
    verb: "Activate tenant",
  },
  deactivate: {
    title: (name) => `Deactivate ${name}`,
    description: "The tenant's owner and staff surfaces go offline immediately. Reactivating restores access.",
    verb: "Deactivate",
  },
  reactivate: {
    title: (name) => `Reactivate ${name}`,
    description: "The tenant's owner and staff surfaces come back online immediately.",
    verb: "Reactivate",
  },
  delete: {
    title: (name) => `Delete ${name}`,
    description: "This permanently deletes the tenant and all of its data for operators. This cannot be undone.",
    verb: "Delete tenant",
  },
};

type Mode = "test" | "live";

// restiq-backend#213: switching Test / Live. Going Live stops simulated payments; going back to Test is
// refused by the API once the tenant has real sales, so the dialog says so up front.
const MODE_DIALOG: Record<Mode, { title: (name: string) => string; description: (name: string) => string; verb: string; checkbox: (name: string) => string }> = {
  live: {
    title: (name) => `Switch ${name} to Live`,
    description: (name) =>
      `Simulated card and QR payments stop working for ${name} - only real payments from then on. Its emails go to the real owner and staff addresses, and it starts counting in the platform figures.`,
    verb: "Switch to Live",
    checkbox: (name) => `I understand ${name} will take real payments only.`,
  },
  test: {
    title: (name) => `Switch ${name} to Test`,
    description: (name) =>
      `Card and QR payments for ${name} become simulated - no money moves. Its emails go to the operators' inbox instead of real addresses, and it drops out of the platform figures. A tenant that already has real sales can't be switched back to Test.`,
    verb: "Switch to Test",
    checkbox: (name) => `I understand ${name}'s payments will be simulated.`,
  },
};

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  outlets: "Outlets",
  devices: "Devices",
  subscription: "Subscription",
  capabilities: "Capabilities",
  owners: "Owners",
  agreements: "Agreements",
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
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [modeTarget, setModeTarget] = useState<Mode | null>(null);
  const [modeBusy, setModeBusy] = useState(false);

  function selectTab(next: TabKey) {
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`);
  }

  async function runLifecycleAction(reason: string) {
    if (!lifecycleAction) return;
    setLifecycleBusy(true);
    try {
      if (lifecycleAction === "delete") {
        await opsApi(`tenants/${params.id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
        toast({ kind: "success", message: "Tenant deleted." });
        router.push("/ops/tenants");
        return;
      }
      await opsApi(`tenants/${params.id}/${lifecycleAction}`, { method: "POST", body: JSON.stringify({ reason }) });
      setLifecycleAction(null);
      toast({ kind: "success", message: LIFECYCLE_SUCCESS[lifecycleAction] });
      load();
    } catch (error) {
      toast({
        kind: "error",
        message: error instanceof OpsApiError ? error.message : LIFECYCLE_FAILURE[lifecycleAction],
      });
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function switchMode(reason: string) {
    if (!modeTarget) return;
    setModeBusy(true);
    try {
      await opsApi(`tenants/${params.id}/mode`, { method: "POST", body: JSON.stringify({ mode: modeTarget, reason }) });
      setModeTarget(null);
      toast({ kind: "success", message: modeTarget === "live" ? "The tenant is now Live." : "The tenant is now in Test mode." });
      load();
    } catch (error) {
      setModeTarget(null);
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The mode could not be changed." });
    } finally {
      setModeBusy(false);
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
            {tenant.testMode && <TestModeBadge testId="tenant-detail-test-badge" />}
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
        <div className="flex items-center gap-2">
          {tenant.status === "provisioning" && (
            <Button data-testid="tenant-activate" onClick={() => setLifecycleAction("activate")}>
              <Rocket aria-hidden="true" /> Activate tenant
            </Button>
          )}
          {tenant.status === "active" && (
            <Button
              variant="outline"
              data-testid="tenant-deactivate"
              onClick={() => setLifecycleAction("deactivate")}
            >
              <PauseCircle aria-hidden="true" /> Deactivate
            </Button>
          )}
          {tenant.status === "inactive" && (
            <Button data-testid="tenant-reactivate" onClick={() => setLifecycleAction("reactivate")}>
              <PlayCircle aria-hidden="true" /> Reactivate
            </Button>
          )}
        </div>
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
        {tab === "devices" && (
          <DevicesTable tenantId={tenant.id} tenantName={tenant.name} tenantOutlets={detail.outlets.map((o) => ({ id: o.id, name: o.name }))} />
        )}
        {tab === "subscription" && <SubscriptionTab tenantId={tenant.id} tenantStatus={tenant.status} />}
        {tab === "capabilities" && <CapabilitiesTab outlets={detail.outlets} />}
        {tab === "owners" && <OwnersTab detail={detail} />}
        {tab === "agreements" && <AgreementsTab tenantId={tenant.id} />}
      </div>

      <section className="mt-10 flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4" data-testid="tenant-mode">
        <div>
          <p className="text-sm font-semibold">{tenant.testMode ? "Test mode" : "Live"}</p>
          <p className="text-xs text-muted-foreground" data-testid="tenant-mode-text">
            {tenant.testMode
              ? "Payments are simulated, emails go to the operators' inbox, and this tenant is left out of the platform figures."
              : `Taking real payments${tenant.liveSince ? ` since ${new Date(tenant.liveSince).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}` : ""}.`}
          </p>
        </div>
        <Button variant="outline" size="sm" data-testid="tenant-mode-switch" onClick={() => setModeTarget(tenant.testMode ? "live" : "test")}>
          {tenant.testMode ? "Switch to Live" : "Switch to Test"}
        </Button>
      </section>

      {/* Danger zone: out of the header, so Delete never sits beside the everyday actions. */}
      <section className="mt-10 flex max-w-3xl items-center justify-between gap-4 rounded-lg border border-status-critical/40 p-4" data-testid="tenant-danger-zone">
        <div>
          <p className="text-sm font-semibold">Delete this tenant</p>
          <p className="text-xs text-muted-foreground">Removes {tenant.name} and all of its data for operators. This cannot be undone.</p>
        </div>
        <Button variant="destructive" size="sm" data-testid="tenant-delete" onClick={() => setLifecycleAction("delete")}>
          <Trash2 aria-hidden="true" /> Delete tenant
        </Button>
      </section>

      {modeTarget && (
        <ConfirmReasonDialog
          open
          title={MODE_DIALOG[modeTarget].title(tenant.name)}
          description={MODE_DIALOG[modeTarget].description(tenant.name)}
          verb={MODE_DIALOG[modeTarget].verb}
          confirmCheckboxLabel={MODE_DIALOG[modeTarget].checkbox(tenant.name)}
          busy={modeBusy}
          onCancel={() => setModeTarget(null)}
          onConfirm={(reason) => void switchMode(reason)}
        />
      )}

      {lifecycleAction && (
        <ConfirmReasonDialog
          open
          title={LIFECYCLE_DIALOG[lifecycleAction].title(tenant.name)}
          description={LIFECYCLE_DIALOG[lifecycleAction].description}
          verb={LIFECYCLE_DIALOG[lifecycleAction].verb}
          destructive={lifecycleAction === "deactivate" || lifecycleAction === "delete"}
          confirmCheckboxLabel={
            lifecycleAction === "delete"
              ? `I understand this permanently deletes ${tenant.name} and cannot be undone.`
              : undefined
          }
          busy={lifecycleBusy}
          onCancel={() => setLifecycleAction(null)}
          onConfirm={(reason) => void runLifecycleAction(reason)}
        />
      )}
    </section>
  );
}
