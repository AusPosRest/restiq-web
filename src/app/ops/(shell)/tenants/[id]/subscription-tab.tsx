"use client";

// CAP-5: plan/invoices/arrears view (O7) narrowed to one tenant - same
// components the fleet-wide Subscriptions screen would use, tenant-scoped
// query, no duplicate designs (EXPERIENCE.md). Suspend/reactivate are
// pessimistic (spinner-in-button via ConfirmReasonDialog's busy state, then a
// result toast) - never optimistic, per EXPERIENCE.md's money/fleet-affecting
// rule.
import { PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { InvoiceView, opsApi, OpsApiError, SubscriptionView } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { StatusBadge } from "../../status-badge";
import { useToast } from "../../toast";
import { useOpsLoad } from "../../use-ops-load";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(amountMinor: string): string {
  return (Number(amountMinor) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SubscriptionTab({ tenantId }: Readonly<{ tenantId: string }>) {
  const toast = useToast();
  const { loading, failed, data, retry } = useOpsLoad<SubscriptionView>(`tenants/${tenantId}/subscription`);
  const invoices = useOpsLoad<{ invoices: InvoiceView[] }>(`tenants/${tenantId}/subscription/invoices`);
  const [confirmKind, setConfirmKind] = useState<"suspend" | "reactivate" | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm(reason: string) {
    if (!confirmKind) return;
    setBusy(true);
    try {
      await opsApi(`tenants/${tenantId}/subscription/${confirmKind}`, { method: "POST", body: JSON.stringify({ reason }) });
      setConfirmKind(null);
      toast({ kind: "success", message: confirmKind === "suspend" ? "Subscription suspended." : "Subscription reactivated." });
      retry();
      invoices.retry();
    } catch (error) {
      toast({
        kind: "error",
        message: error instanceof OpsApiError ? error.message : `Could not ${confirmKind} this subscription.`,
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl" data-testid="subscription-loading">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    );
  }

  if (failed || !data) {
    return <LoadErrorPanel message="The subscription could not be loaded." onRetry={retry} testId="subscription-error" />;
  }

  const sub = data;

  return (
    <div className="grid max-w-3xl gap-4" data-testid="subscription-tab">
      <div className="rounded-lg border border-border/40 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-lg font-semibold">Subscription</h2>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={sub.status} testId="subscription-status" />
              <span className="text-sm text-muted-foreground">
                {sub.plan} · {sub.billingPeriod}
              </span>
            </div>
          </div>
          {sub.status === "suspended" ? (
            <button
              type="button"
              data-testid="subscription-reactivate"
              onClick={() => setConfirmKind("reactivate")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlayCircle aria-hidden="true" className="size-4" /> Reactivate
            </button>
          ) : (
            <button
              type="button"
              data-testid="subscription-suspend"
              onClick={() => setConfirmKind("suspend")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-status-critical/50 px-3 py-2 text-sm font-semibold text-status-critical hover:bg-status-critical/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PauseCircle aria-hidden="true" className="size-4" /> Suspend
            </button>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current period</dt>
            <dd className="mt-1" data-testid="subscription-period">
              {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}
            </dd>
          </div>
          <div>
            <dt className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grace window</dt>
            <dd className="mt-1" data-testid="subscription-grace-window">
              {sub.graceWindowHours}h
            </dd>
          </div>
          {sub.suspendedAt && (
            <div>
              <dt className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suspended</dt>
              <dd className="mt-1" data-testid="subscription-suspended-at">
                {formatDate(sub.suspendedAt)}
              </dd>
            </div>
          )}
        </dl>

        {sub.status === "suspended" && (
          <div
            data-testid="subscription-suspended-banner"
            className="mt-5 flex items-start gap-2 rounded-lg border border-status-critical/40 bg-status-critical/10 p-3 text-sm text-foreground"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-status-critical" aria-hidden="true" />
            <span>
              Admin console and reporting are read-only for this tenant. The POS keeps trading through the {sub.graceWindowHours}
              -hour grace window.
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/40 bg-card">
        <h3 className="font-headline px-5 pt-5 text-base font-semibold">Invoices</h3>
        {invoices.loading ? (
          <div className="p-5">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : invoices.failed || !invoices.data ? (
          <div className="p-5">
            <LoadErrorPanel message="Invoices could not be loaded." onRetry={invoices.retry} testId="invoices-error" />
          </div>
        ) : invoices.data.invoices.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-sm text-muted-foreground" data-testid="invoices-empty">
            No invoices yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" data-testid="invoices-table">
              <thead>
                <tr className="h-10 border-b border-border/40">
                  {["Period", "Amount", "Status"].map((heading) => (
                    <th key={heading} className="font-label px-5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.data.invoices.map((invoice) => (
                  <tr key={invoice.id} data-testid={`invoices-row-${invoice.id}`} className="h-12 border-b border-border/20 last:border-b-0">
                    <td className="px-5 font-medium">{invoice.period}</td>
                    <td className="px-5 tabular-nums text-muted-foreground">{formatAmount(invoice.amountMinor)}</td>
                    <td className="px-5">
                      <StatusBadge status={invoice.status} testId={`invoice-status-${invoice.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmReasonDialog
        open={confirmKind !== null}
        title={confirmKind === "suspend" ? "Suspend this subscription?" : "Reactivate this subscription?"}
        destructive={confirmKind === "suspend"}
        description={
          confirmKind === "suspend"
            ? "Admin console and reporting lock immediately; the POS keeps trading through the grace window."
            : "Full access is restored immediately."
        }
        verb={confirmKind === "suspend" ? "Suspend" : "Reactivate"}
        busy={busy}
        onCancel={() => setConfirmKind(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </div>
  );
}
