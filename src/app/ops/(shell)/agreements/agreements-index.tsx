"use client";

// Agreements (issue #192): the platform's numbered agreement versions, newest
// first, plus the publish form. Publishing is pessimistic and goes through
// the shared reason dialog like every other console mutation - the reason
// lands in the control-plane audit trail (restiq-backend#133). A version is
// immutable once published, so there is no edit or delete here by design. An
// agreement is a PDF (restiq-backend#179): ops picks the file, previews it in the
// browser before publishing, and can open any published version in the viewer.
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgreementVersionSummary, AgreementVersionView, OpsApiError, publishAgreement } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
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
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const nextVersion = (data?.versions[0]?.version ?? 0) + 1;
  const canPublish = title.trim().length > 0 && file !== null && fileError === null;

  // The chosen file is previewed locally, so what ops checks is exactly what gets uploaded.
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  function chooseFile(chosen: File | null) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPreviewUrl(null);
    setFile(chosen);
    if (!chosen) return setFileError(null);
    if (chosen.type !== "application/pdf" && !chosen.name.toLowerCase().endsWith(".pdf")) return setFileError("Choose a PDF file.");
    if (chosen.size > MAX_PDF_BYTES) return setFileError("The PDF is over 5 MB. Choose a smaller file.");
    setFileError(null);
    objectUrl.current = URL.createObjectURL(chosen);
    setPreviewUrl(objectUrl.current);
  }

  async function publish(reason: string) {
    setBusy(true);
    try {
      const { version } = await publishAgreement(title.trim(), file as File, reason);
      setConfirming(false);
      setTitle("");
      chooseFile(null);
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
            <label htmlFor="agreement-file" className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agreement PDF (max 5 MB)
            </label>
            <input
              id="agreement-file"
              data-testid="agreement-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              className={FIELD_CLASSES}
            />
            {fileError && (
              <p role="alert" data-testid="agreement-file-error" className="mt-1.5 text-xs text-status-error">
                {fileError}
              </p>
            )}
            {previewUrl && !fileError && (
              <iframe data-testid="agreement-preview" title="Preview of the agreement PDF" src={previewUrl} className="mt-3 h-96 w-full rounded-lg border border-border/40 bg-background" />
            )}
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
        description="Every tenant owner will be asked to read and sign this PDF the next time they open their console. Published versions cannot be edited."
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
  if (failed || !data) return <LoadErrorPanel message="The agreement could not be loaded." onRetry={retry} testId="agreement-body-error" />;
  if (!data.version.hasFile) {
    return (
      <p data-testid="agreement-no-file" className="rounded-lg border border-border/40 bg-background p-4 text-sm text-muted-foreground">
        Published as text before agreements became PDFs; there is no file to show. Owners cannot sign it - publish a new version.
      </p>
    );
  }
  const url = `/ops/api/agreements/${id}/file`;
  return (
    <div>
      <iframe data-testid="agreement-viewer" title={`${data.version.title} (PDF)`} src={url} className="h-96 w-full rounded-lg border border-border/40 bg-background" />
      <p className="mt-2 text-xs text-muted-foreground">
        {data.version.fileName} ·{" "}
        <a data-testid="agreement-open" href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          open in a new tab
        </a>{" "}
        · SHA-256 <span className="font-mono">{data.version.fileSha256.slice(0, 12)}…</span>
      </p>
    </div>
  );
}
