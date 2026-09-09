"use client";

// Agreements (issue #192): the platform's numbered agreement versions, newest
// first, plus the publish form. Publishing is pessimistic and goes through
// the shared reason dialog like every other console mutation - the reason
// lands in the control-plane audit trail (restiq-backend#133). A version is
// immutable once published, so there is no edit or delete here by design.
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AgreementVersionSummary, AgreementVersionView, opsApi, OpsApiError } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";

const FIELD_CLASSES =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TH_CLASSES = "font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AgreementsIndex() {
  const toast = useToast();
  const { loading, failed, data, retry } = useOpsLoad<{ versions: AgreementVersionSummary[] }>("agreements");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const nextVersion = (data?.versions[0]?.version ?? 0) + 1;
  const canPublish = title.trim().length > 0 && body.trim().length > 0;

  async function publish(reason: string) {
    setBusy(true);
    try {
      const { version } = await opsApi<{ version: AgreementVersionView }>("agreements", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body, reason }),
      });
      setConfirming(false);
      setTitle("");
      setBody("");
      toast({ kind: "success", message: `Agreement v${version.version} published.` });
      retry();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The agreement could not be published." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-1 flex-col">
      <h1 className="font-headline text-2xl font-semibold">Agreements</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Publish a new version of the platform agreement. Every tenant owner is asked to sign the current version; earlier versions stay on record.
      </p>

      <form
        className="mt-6 max-w-3xl rounded-lg border border-border/40 bg-card p-5"
        data-testid="agreement-publish-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canPublish) setConfirming(true);
        }}
      >
        <h2 className="font-headline text-lg font-semibold">Publish version {nextVersion}</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor="agreement-title" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </label>
            <input
              id="agreement-title"
              data-testid="agreement-title"
              value={title}
              maxLength={200}
              placeholder="e.g. Restiq Platform Services Agreement"
              onChange={(event) => setTitle(event.target.value)}
              className={FIELD_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="agreement-body" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agreement text
            </label>
            <textarea
              id="agreement-body"
              data-testid="agreement-body"
              value={body}
              rows={12}
              placeholder="Paste the full agreement text. Owners see it exactly as entered."
              onChange={(event) => setBody(event.target.value)}
              className={`${FIELD_CLASSES} font-mono`}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" data-testid="agreement-publish" disabled={!canPublish || loading}>
            Publish version {nextVersion}
          </Button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {failed ? (
          <div className="p-4">
            <LoadErrorPanel message="The agreement versions could not be loaded." onRetry={retry} testId="agreements-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="agreements-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className={TH_CLASSES}>Version</th>
                <th className={TH_CLASSES}>Title</th>
                <th className={TH_CLASSES}>Published by</th>
                <th className={TH_CLASSES}>Published</th>
                <th className={`${TH_CLASSES} text-right`}>Signatures</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 3 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "agreements-loading" : undefined}>
                    {Array.from({ length: 5 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && data?.versions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground" data-testid="agreements-empty">
                    No agreement has been published yet.
                  </td>
                </tr>
              )}
              {!loading && data?.versions.map((version, index) => <VersionRow key={version.id} version={version} current={index === 0} />)}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmReasonDialog
        open={confirming}
        title={`Publish agreement v${nextVersion}`}
        description="Every tenant owner will be asked to sign this version the next time they open their console. Published versions cannot be edited."
        verb="Publish"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void publish(reason)}
      />
    </section>
  );
}

function VersionRow({ version, current }: Readonly<{ version: AgreementVersionSummary; current: boolean }>) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <>
      <tr className="h-12 border-b border-border/20" data-testid={`agreement-row-${version.version}`}>
        <td className="px-4">
          <button
            type="button"
            data-testid={`agreement-expand-${version.version}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-md font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Chevron className="size-4 text-muted-foreground" aria-hidden="true" />v{version.version}
            {current && (
              <span className="font-label ml-1 rounded-[6px] border border-status-healthy/50 bg-status-healthy/10 px-1.5 text-[10px] uppercase tracking-wider text-status-healthy">
                current
              </span>
            )}
          </button>
        </td>
        <td className="px-4">{version.title}</td>
        <td className="px-4 text-muted-foreground">{version.publishedBy}</td>
        <td className="px-4 text-muted-foreground">{formatDateTime(version.publishedAt)}</td>
        <td className="px-4 text-right tabular-nums" data-testid={`agreement-signatures-${version.version}`}>
          {version.signatureCount}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/20">
          <td colSpan={5} className="px-4 pb-4">
            <VersionBody id={version.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function VersionBody({ id }: Readonly<{ id: string }>) {
  const { loading, failed, data, retry } = useOpsLoad<{ version: AgreementVersionView }>(`agreements/${id}`);
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (failed || !data) return <LoadErrorPanel message="The agreement text could not be loaded." onRetry={retry} testId="agreement-body-error" />;
  return (
    <pre data-testid="agreement-body-text" className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-background p-4 font-sans text-sm">
      {data.version.body}
    </pre>
  );
}
