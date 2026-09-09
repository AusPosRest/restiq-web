"use client";

// O5 Agreements tab (issue #192): this tenant's standing against the current
// platform agreement and every signature it has on record. Read-only - only
// the owner can sign, from their own console.
import { AgreementSignatureView, TenantAgreementsView } from "../../api";
import { formatDateTime } from "../../agreements/agreements-index";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { StatusBadge } from "../../status-badge";
import { useOpsLoad } from "../../use-ops-load";

const TH_CLASSES = "font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function AgreementsTab({ tenantId }: Readonly<{ tenantId: string }>) {
  const { loading, failed, data, retry } = useOpsLoad<TenantAgreementsView>(`tenants/${tenantId}/agreements`);

  if (loading) {
    return (
      <div className="max-w-3xl" data-testid="agreements-loading">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (failed || !data) {
    return <LoadErrorPanel message="The agreement standing could not be loaded." onRetry={retry} testId="agreements-error" />;
  }

  return (
    <div className="grid max-w-3xl gap-4" data-testid="agreements-tab">
      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="font-headline text-lg font-semibold">Current agreement</h2>
        <div className="mt-2 flex items-center gap-3">
          <StatusBadge status={data.status} testId="agreement-status" />
          {data.current ? (
            <span className="text-sm text-muted-foreground" data-testid="agreement-current">
              v{data.current.version} · {data.current.title} · published {formatDateTime(data.current.publishedAt)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground" data-testid="agreement-current">
              No agreement has been published yet.
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
        <h3 className="font-headline px-5 pt-5 text-base font-semibold">Signatures</h3>
        {data.signatures.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-sm text-muted-foreground" data-testid="agreement-signatures-empty">
            Nothing signed yet.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm" data-testid="agreement-signatures">
            <thead>
              <tr className="h-10 border-y border-border/40">
                <th className={TH_CLASSES}>Version</th>
                <th className={TH_CLASSES}>Signed by</th>
                <th className={TH_CLASSES}>Signed</th>
                <th className={TH_CLASSES}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {data.signatures.map((signature) => (
                <SignatureRow key={signature.agreementVersionId} signature={signature} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SignatureRow({ signature }: Readonly<{ signature: AgreementSignatureView }>) {
  return (
    <tr className="h-12 border-b border-border/20" data-testid={`agreement-signature-${signature.version}`}>
      <td className="px-4">
        <span className="font-semibold tabular-nums">v{signature.version}</span>
        <span className="ml-2 text-muted-foreground">{signature.title}</span>
      </td>
      <td className="px-4">
        {signature.signerName}
        <span className="ml-2 text-muted-foreground">{signature.signerEmail}</span>
      </td>
      <td className="px-4 text-muted-foreground">{formatDateTime(signature.signedAt)}</td>
      <td className="px-4 font-mono text-xs text-muted-foreground" title={signature.evidenceSha256}>
        {signature.evidenceSha256.slice(0, 12)}…
      </td>
    </tr>
  );
}
