"use client";

// Settings ▸ Agreement (issues #192, #238): the owner reads the current
// platform agreement as a formatted document, gives their full name and
// title, and signs in DocuSign - "Review and sign" opens DocuSign's signing
// session, which returns here. Restiq then countersigns by email; once both
// have signed, DocuSign seals the PDF (with its Certificate of Completion)
// and it can be downloaded here. Pessimistic throughout (money/legal rule in
// EXPERIENCE.md): nothing shows as signed until the server says so.
import { CheckCircle2, Clock, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { AgreementDocument } from "@/components/agreement-document";
import { Button } from "@/components/ui/button";
import { AdminApiError, AgreementSignatureView, OwnerAgreementView, OwnerSigningView, startAgreementSigning } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useAdminLoad } from "../use-admin-load";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-md font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// What DocuSign's ?event= on the way back means for the owner.
const RETURN_MESSAGES: Record<string, { kind: "success" | "error"; message: string }> = {
  signing_complete: { kind: "success", message: "Thanks, you've signed. Restiq will countersign, then the signed PDF appears here." },
  cancel: { kind: "error", message: "Signing is paused. Pick up where you left off with Continue signing." },
  decline: { kind: "error", message: "You declined to sign in DocuSign. Contact Restiq support if you have questions about the agreement." },
  session_timeout: { kind: "error", message: "The DocuSign session timed out. Open it again to carry on." },
  ttl_expired: { kind: "error", message: "The DocuSign link expired. Open it again to carry on." },
  exception: { kind: "error", message: "DocuSign ran into a problem. Try again." },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pdfHref(versionId: string): string {
  return `/admin/api/agreement/${versionId}/pdf`;
}

export function AgreementSigner() {
  const { loading, failed, data, retry } = useAdminLoad<OwnerAgreementView>("agreement");
  const pushToast = useToast();

  // DocuSign sends the owner back with ?event=...: say what happened once, then drop it from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const event = params.get("event");
    if (!event) return;
    const message = RETURN_MESSAGES[event];
    if (message) pushToast(message);
    params.delete("event");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [pushToast]);

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
  // Keyed on the version so a newly published agreement remounts with a fresh form.
  return <AgreementView key={data.current.id} current={data.current} signature={data.signature} signing={data.signing} history={data.history} onStale={retry} />;
}

function AgreementView({
  current,
  signature,
  signing,
  history,
  onStale,
}: Readonly<{
  current: NonNullable<OwnerAgreementView["current"]>;
  signature: AgreementSignatureView | null;
  signing: OwnerSigningView | null;
  history: AgreementSignatureView[];
  onStale: () => void;
}>) {
  const previous = history.filter((entry) => entry.agreementVersionId !== current.id);

  return (
    <div className="max-w-3xl space-y-6" data-testid="agreement-view">
      <section className="rounded-lg border border-border/40 bg-card p-6">
        <h2 className="font-headline text-lg font-semibold" data-testid="agreement-title">
          {current.title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground" data-testid="agreement-version">
          Version {current.version} · published {formatDateTime(current.publishedAt)}
        </p>
        <div className="mt-4 max-h-[32rem] overflow-auto rounded-lg border border-border/40 bg-background px-6 py-5">
          <AgreementDocument body={current.body} testId="agreement-body" />
        </div>
      </section>

      {signature ? (
        <SignedPanel versionId={current.id} signature={signature} />
      ) : signing?.status === "awaiting_countersign" ? (
        <section
          className="flex items-start gap-3 rounded-lg border border-status-warning/40 bg-status-warning/10 p-5 text-sm"
          data-testid="agreement-awaiting-countersign"
          role="status"
        >
          <Clock className="mt-0.5 size-5 shrink-0 text-status-warning" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              You signed{signing.ownerSignedAt ? ` on ${formatDateTime(signing.ownerSignedAt)}` : ""} as {signing.signerName}, {signing.signerTitle}.
            </p>
            <p className="mt-1 text-muted-foreground">
              Waiting for Restiq to countersign. DocuSign emails you the completed agreement, and the signed PDF appears here.
            </p>
          </div>
        </section>
      ) : (
        <SignForm versionId={current.id} signing={signing} onStale={onStale} />
      )}

      {previous.length > 0 && (
        <section className="rounded-lg border border-border/40 bg-card p-6" data-testid="agreement-history">
          <h3 className="font-headline text-base font-semibold">Previously signed</h3>
          <ul className="mt-3 divide-y divide-border/40 text-sm">
            {previous.map((entry) => (
              <li key={entry.agreementVersionId} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={`agreement-history-${entry.version}`}>
                <span>
                  <span className="font-semibold tabular-nums">v{entry.version}</span> <span className="text-muted-foreground">{entry.title}</span>
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  {entry.signerName} · {formatDateTime(entry.signedAt)}
                  {entry.hasPdf && (
                    <a href={pdfHref(entry.agreementVersionId)} download className={LINK_CLASS} data-testid={`agreement-history-pdf-${entry.version}`}>
                      <Download className="size-4" aria-hidden="true" />
                      PDF<span className="sr-only"> of signed version {entry.version}</span>
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SignedPanel({ versionId, signature }: Readonly<{ versionId: string; signature: AgreementSignatureView }>) {
  return (
    <section className="flex items-start gap-3 rounded-lg border border-status-active/40 bg-status-active/10 p-5 text-sm" data-testid="agreement-signed" role="status">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-status-active" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">
          Signed by {signature.signerName}
          {signature.signerTitle ? `, ${signature.signerTitle}` : ""} on {formatDateTime(signature.signedAt)}
        </p>
        <p className="mt-1 text-muted-foreground">{signature.signerEmail}</p>
        {signature.hasPdf ? (
          <>
            <p className="mt-1 text-muted-foreground">Countersigned by Restiq and sealed by DocuSign.</p>
            <a href={pdfHref(versionId)} download className={`${LINK_CLASS} mt-3`} data-testid="agreement-pdf">
              <Download className="size-4" aria-hidden="true" />
              Download signed PDF
            </a>
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">Signed with a typed name before DocuSign signing was introduced, so there is no sealed PDF.</p>
        )}
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground" title="SHA-256 fingerprint of the signed document">
          Evidence {signature.evidenceSha256}
        </p>
      </div>
    </section>
  );
}

function SignForm({ versionId, signing, onStale }: Readonly<{ versionId: string; signing: OwnerSigningView | null; onStale: () => void }>) {
  const pushToast = useToast();
  // Resuming an envelope DocuSign already holds: the name and title are on that document, so they're fixed.
  const resuming = signing?.status === "awaiting_owner";
  const [signerName, setSignerName] = useState(signing?.signerName ?? "");
  const [signerTitle, setSignerTitle] = useState(signing?.signerTitle ?? "");
  const [opening, setOpening] = useState(false);

  const canSign = signerName.trim().length > 0 && signerTitle.trim().length > 0 && !opening;

  async function handleSign() {
    setOpening(true);
    try {
      const { url } = await startAgreementSigning(versionId, { signerName: signerName.trim(), signerTitle: signerTitle.trim() });
      // Stays "Opening DocuSign..." while the browser leaves for the signing session.
      window.location.assign(url);
    } catch (error) {
      setOpening(false);
      if (error instanceof AdminApiError && error.status === 409) {
        // already_signed / awaiting_countersign / stale_version / signing_in_progress: the server's view moved on - reload it.
        pushToast({ kind: "error", message: error.message });
        onStale();
      } else if (error instanceof AdminApiError && error.status === 503) {
        pushToast({ kind: "error", message: error.message });
      } else {
        pushToast({ kind: "error", message: "Couldn't open DocuSign. Try again.", onRetry: () => void handleSign() });
      }
    }
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-border/40 bg-card p-6"
      data-testid="agreement-sign-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSign) void handleSign();
      }}
    >
      <div>
        <h3 className="font-headline text-base font-semibold">Sign this agreement</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You review and sign in DocuSign, then come back here. Restiq countersigns afterwards. Both signatures, the signing times and DocuSign&apos;s Certificate of
          Completion go into a sealed PDF you can download.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="agreement-signer-name" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your full legal name
          </label>
          <input
            id="agreement-signer-name"
            data-testid="agreement-signer-name"
            type="text"
            autoComplete="name"
            maxLength={200}
            required
            disabled={resuming}
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="agreement-signer-title" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your title
          </label>
          <input
            id="agreement-signer-title"
            data-testid="agreement-signer-title"
            type="text"
            autoComplete="organization-title"
            maxLength={120}
            required
            placeholder="e.g. Director"
            disabled={resuming}
            value={signerTitle}
            onChange={(event) => setSignerTitle(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
      </div>
      {resuming && (
        <p className="text-xs text-muted-foreground" data-testid="agreement-resume-note">
          You&apos;ve already started signing. Your name and title are on the document in DocuSign.
        </p>
      )}
      <div className="flex justify-end border-t border-border/40 pt-4">
        <Button type="submit" data-testid="agreement-sign" disabled={!canSign}>
          {opening ? "Opening DocuSign..." : resuming ? "Continue signing" : "Review and sign"}
        </Button>
      </div>
    </form>
  );
}
