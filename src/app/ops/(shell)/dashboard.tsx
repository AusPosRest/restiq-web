"use client";

// O2 dashboard: KPI tiles that load, fail and retry independently, plus the
// recent-onboardings list. Alert tiles link into Sync Health pre-filtered.
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TenantListResult } from "./api";
import { LoadErrorPanel, Skeleton } from "./data-states";
import { StatusBadge } from "./status-badge";
import { useOpsLoad } from "./use-ops-load";

interface TileConfig {
  key: string;
  label: string;
  note?: string;
  href?: string;
}

const TILES: TileConfig[] = [
  { key: "active_tenants", label: "Active tenants" },
  { key: "outlets", label: "Outlets" },
  { key: "devices_online", label: "Devices online", note: "Fleet telemetry pending", href: "/ops/sync-health?filter=silent" },
  { key: "open_dlq", label: "Open DLQ", note: "DLQ browsing pending", href: "/ops/sync-health?filter=rejections" },
];

function KpiTile({ tile }: Readonly<{ tile: TileConfig }>) {
  const { loading, failed, data, retry } = useOpsLoad<{ value: number }>(`dashboard/kpis/${tile.key}`);

  const body = (
    <>
      <p className="font-label flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {tile.label}
        {tile.href && <ArrowUpRight className="size-3.5" aria-hidden="true" />}
      </p>
      <div className="mt-3">
        {loading && <Skeleton className="h-9 w-20" data-testid={`kpi-${tile.key}-loading`} />}
        {failed && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-status-critical">Failed to load</span>
            <button
              type="button"
              data-testid={`kpi-${tile.key}-retry`}
              onClick={(event) => {
                event.preventDefault();
                retry();
              }}
              className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
            </button>
          </div>
        )}
        {data && (
          <p data-testid={`kpi-${tile.key}-value`} className="text-3xl font-semibold tabular-nums">
            {data.value.toLocaleString()}
          </p>
        )}
      </div>
      {tile.note && <p className="mt-2 text-xs text-muted-foreground">{tile.note}</p>}
    </>
  );

  const classes =
    "block rounded-lg border border-border/40 bg-card p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return tile.href ? (
    <Link href={tile.href} data-testid={`kpi-${tile.key}`} className={`${classes} transition-colors hover:border-border`}>
      {body}
    </Link>
  ) : (
    <div data-testid={`kpi-${tile.key}`} className={classes}>
      {body}
    </div>
  );
}

function RecentOnboardings() {
  const router = useRouter();
  const { loading, failed, data, retry } = useOpsLoad<TenantListResult>("tenants?limit=5");

  return (
    <section className="mt-8" aria-label="Recent onboardings">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-lg font-semibold">Recent onboardings</h2>
        <Link
          href="/ops/tenants"
          data-testid="dashboard-all-tenants"
          className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          All tenants
        </Link>
      </div>
      <div className="mt-3 rounded-lg border border-border/40 bg-card">
        {loading && (
          <div className="flex flex-col gap-3 p-4" data-testid="recent-onboardings-loading">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-9" />
            ))}
          </div>
        )}
        {failed && (
          <div className="p-4">
            <LoadErrorPanel message="Recent onboardings could not be loaded." onRetry={retry} testId="recent-onboardings-error" />
          </div>
        )}
        {data &&
          (data.tenants.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground" data-testid="recent-onboardings-empty">
              No tenants yet - the first onboarding will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border/40" data-testid="recent-onboardings">
              {data.tenants.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    type="button"
                    data-testid={`recent-onboarding-${tenant.id}`}
                    onClick={() => router.push(`/ops/tenants/${tenant.id}`)}
                    className="flex h-12 w-full items-center justify-between gap-4 px-4 text-left text-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate font-medium">{tenant.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted-foreground">{tenant.country}</span>
                      <StatusBadge status={tenant.status} />
                      <span className="tabular-nums text-muted-foreground">
                        {new Date(tenant.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

export function Dashboard() {
  return (
    <section>
      <h1 className="font-headline text-2xl font-semibold">Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {TILES.map((tile) => (
          <KpiTile key={tile.key} tile={tile} />
        ))}
      </div>
      <RecentOnboardings />
    </section>
  );
}
