"use client";

// T8 Owner Dashboard (CAP-8): tenant-wide real counts, per-outlet financial
// KPIs (honest no-data state until POS Core Loop exists), and a cross-outlet
// comparison once there's more than one outlet. Single GET, same
// load/error/retry shape as staff.tsx (useAdminLoad exists precisely for
// this GET-and-render pattern).
import { LayoutDashboard, MonitorSmartphone, Soup, Store, Users } from "lucide-react";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useAdminLoad } from "../use-admin-load";
import type { DashboardView } from "./dashboard-state";
import { FreshnessBadge } from "./freshness-badge";
import { CountValue, KpiStatCard } from "./kpi-stat-card";
import { OutletComparisonTable } from "./outlet-comparison-table";
import { OutletKpiTiles } from "./outlet-kpi-tiles";

function LoadingShell() {
  return (
    <div className="space-y-6" data-testid="dashboard-loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export function Dashboard() {
  const { loading, failed, data, retry } = useAdminLoad<DashboardView>("dashboard");

  if (loading) return <LoadingShell />;
  if (failed) return <LoadErrorPanel testId="dashboard-load-error" message="The dashboard couldn't be loaded." onRetry={retry} />;
  if (!data) return null;

  return <DashboardContent view={data} />;
}

function DashboardContent({ view }: Readonly<{ view: DashboardView }>) {
  const { counts, outlets, asOf, stale } = view;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-headline text-2xl font-semibold">Dashboard</h1>
        <FreshnessBadge asOf={asOf} stale={stale} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiStatCard testId="dashboard-count-outlets" label="Outlets" icon={Store}>
          <CountValue testId="dashboard-count-outlets-value" value={counts.outlets} />
        </KpiStatCard>
        <KpiStatCard testId="dashboard-count-staff" label="Staff" icon={Users}>
          <CountValue testId="dashboard-count-staff-value" value={counts.staff} />
        </KpiStatCard>
        <KpiStatCard testId="dashboard-count-menu-items" label="Menu items" icon={Soup}>
          <CountValue testId="dashboard-count-menu-items-value" value={counts.menuItems} />
        </KpiStatCard>
        <KpiStatCard testId="dashboard-count-devices" label="Devices" icon={MonitorSmartphone}>
          <CountValue testId="dashboard-count-devices-value" value={counts.devices} />
        </KpiStatCard>
      </div>

      {outlets.length === 0 ? (
        <div data-testid="dashboard-no-outlets" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
          <LayoutDashboard className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-headline text-lg font-medium">No outlets yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Once an outlet is set up, its sales, margin, labour and waste will show up here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {outlets.map((outlet) => (
            <section key={outlet.outletId} data-testid={`dashboard-outlet-section-${outlet.outletId}`}>
              <h2 className="font-headline text-lg font-semibold">{outlet.outletName}</h2>
              <div className="mt-3">
                <OutletKpiTiles outlet={outlet} />
              </div>
            </section>
          ))}
        </div>
      )}

      {outlets.length > 1 && (
        <section>
          <h2 className="font-headline text-lg font-semibold">Compare outlets</h2>
          <div className="mt-3">
            <OutletComparisonTable outlets={outlets} />
          </div>
        </section>
      )}
    </div>
  );
}
