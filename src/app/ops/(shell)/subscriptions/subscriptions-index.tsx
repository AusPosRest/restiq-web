"use client";

// CAP-5 fleet entry point: no cross-tenant subscription aggregate exists yet
// (per-tenant state lives on the region plane, AD-9) - this lists tenants and
// jumps into each one's Subscription tab, the same tenant-scoped view O5
// hosts (EXPERIENCE.md: no duplicate designs).
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { TenantListResult } from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { StatusBadge } from "../status-badge";
import { useOpsLoad } from "../use-ops-load";

export function SubscriptionsIndex() {
  const router = useRouter();
  const { loading, failed, data, retry } = useOpsLoad<TenantListResult>("tenants?limit=100&sort=name&order=asc");

  function open(tenantId: string) {
    router.push(`/ops/tenants/${tenantId}?tab=subscription`);
  }

  return (
    <section className="flex flex-1 flex-col">
      <h1 className="font-headline text-2xl font-semibold">Subscriptions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Select a tenant to view its plan, invoices and suspend/reactivate it.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {failed ? (
          <div className="p-4">
            <LoadErrorPanel message="The tenant list could not be loaded." onRetry={retry} testId="subscriptions-index-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="subscriptions-index-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Country</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "subscriptions-index-loading" : undefined}>
                    {Array.from({ length: 4 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                data?.tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    data-testid={`subscriptions-index-row-${tenant.id}`}
                    tabIndex={0}
                    onClick={() => open(tenant.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") open(tenant.id);
                    }}
                    className="h-12 cursor-pointer border-b border-border/20 transition-colors last:border-b-0 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <td className="px-4 font-medium">{tenant.name}</td>
                    <td className="px-4 text-muted-foreground">{tenant.plan}</td>
                    <td className="px-4 text-muted-foreground">{tenant.country}</td>
                    <td className="px-4">
                      <StatusBadge status={tenant.status} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {!loading && data && data.tenants.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center" data-testid="subscriptions-index-empty">
            <CreditCard className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-headline text-lg font-medium">No tenants yet</p>
            <p className="mt-1 text-sm text-muted-foreground">A tenant&apos;s subscription appears here once it is provisioned.</p>
          </div>
        )}
      </div>
    </section>
  );
}
