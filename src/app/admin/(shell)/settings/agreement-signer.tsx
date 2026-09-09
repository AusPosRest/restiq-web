"use client";

// Settings ▸ Agreement (issue #192): the owner reads the current platform
// agreement and signs it by typing their full name and ticking consent - the
// typed name is the signature, the backend seals it with a SHA-256 evidence
// hash (restiq-backend#133). Signing is pessimistic (money/legal rule in
// EXPERIENCE.md): the form stays until the server confirms, then the signed
// record replaces it. A new version published later re-opens the form; what
// was signed before stays listed underneath.
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, AgreementSignatureView, OwnerAgreementView, signAgreement } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useAdminLoad } from "../use-admin-load";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AgreementSigner() {
  const { loading, failed, data, retry } = useAdminLoad<OwnerAgreementView>("agreement");

  if (loading) {
    return (
      <div className="space-y-6 rounded-lg border border-border/40 bg-card p-6" data-testid="agreement-loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (failed || !data) {
    return <LoadErrorPanel testId="agreement-load-error" message="The agreement couldn't be loaded." onRetry={retry} />;
  }
  if (!data.current) {
    return (
      <p className="max-w-2xl rounded-lg border border-border/40 bg-card p-6 text-sm text-muted-foreground" data-testid="agreement-empty">
        No agreement has been published for your business yet. Nothing to sign for now.
      </p>
    );
  }
  // Keyed on the version so a newly published agreement remounts with a fresh, unsigned form.
  return <AgreementView key={data.current.id} current={data.current} initialSignature={data.signature} history={data.history} onStale={retry} />;
}

function AgreementView({
  current,
  initialSignature,
  history,
  onStale,
}: Readonly<{
  current: NonNullable<OwnerAgreementView["current"]>;
  initialSignature: AgreementSignatureView | null;
  history: AgreementSignatureView[];
  onStale: () => void;
}>) {
  const pushToast = useToast();
  const [signature, setSignature] = useState(initialSignature);
  const [signerName, setSignerName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  const canSign = signerName.trim().length > 0 && accepted && !signing;
  const previous = history.filter((entry) => entry.agreementVersionId !== current.id);

  async function handleSign() {
    setSigning(true);
    try {
      const result = await signAgreement(current.id, signerName.trim());
      setSignature(result.signature);
      pushToast({ kind: "success", message: `Agreement v${current.version} signed.` });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 409) {
        // already_signed or stale_version: the server's view has moved on - reload it rather than guess.
        pushToast({ kind: "error", message: error.message });
        onStale();
      } else {
        pushToast({ kind: "error", message: "Couldn't record your signature. Try again.", onRetry: () => void handleSign() });
      }
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6" data-testid="agreement-view">
      <section className="rounded-lg border border-border/40 bg-card p-6">
        <h2 className="font-headline text-lg font-semibold" data-testid="agreement-title">
          {current.title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground" data-testid="agreement-version">
          Version {current.version} · published {formatDateTime(current.publishedAt)}
        </p>
        <pre data-testid="agreement-body" className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-background p-4 font-sans text-sm">
          {current.body}
        </pre>
      </section>

      {signature ? (
        <section
          className="flex items-start gap-3 rounded-lg border border-status-active/40 bg-status-active/10 p-5 text-sm"
          data-testid="agreement-signed"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-status-active" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Signed by {signature.signerName} on {formatDateTime(signature.signedAt)}
            </p>
            <p className="mt-1 text-muted-foreground">{signature.signerEmail}</p>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground" title="SHA-256 evidence hash of what was signed, by whom and when">
              Evidence {signature.evidenceSha256}
            </p>
          </div>
        </section>
      ) : (
        <form
          className="space-y-4 rounded-lg border border-border/40 bg-card p-6"
          data-testid="agreement-sign-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSign) void handleSign();
          }}
        >
          <h3 className="font-headline text-base font-semibold">Sign this agreement</h3>
          <div>
            <label htmlFor="agreement-signer-name" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your full name (this is your signature)
            </label>
            <input
              id="agreement-signer-name"
              data-testid="agreement-signer-name"
              type="text"
              autoComplete="name"
              maxLength={200}
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="agreement-accept"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 size-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>
              I have read and agree to version {current.version} of this agreement on behalf of my business. My name, email and the time of signing will be recorded.
            </span>
          </label>
          <div className="flex justify-end border-t border-border/40 pt-4">
            <Button type="submit" data-testid="agreement-sign" disabled={!canSign}>
              {signing ? "Signing..." : "Sign agreement"}
            </Button>
          </div>
        </form>
      )}

      {previous.length > 0 && (
        <section className="rounded-lg border border-border/40 bg-card p-6" data-testid="agreement-history">
          <h3 className="font-headline text-base font-semibold">Previously signed</h3>
          <ul className="mt-3 divide-y divide-border/40 text-sm">
            {previous.map((entry) => (
              <li key={entry.agreementVersionId} className="flex flex-wrap justify-between gap-2 py-2" data-testid={`agreement-history-${entry.version}`}>
                <span>
                  <span className="font-semibold tabular-nums">v{entry.version}</span> <span className="text-muted-foreground">{entry.title}</span>
                </span>
                <span className="text-muted-foreground">
                  {entry.signerName} · {formatDateTime(entry.signedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
