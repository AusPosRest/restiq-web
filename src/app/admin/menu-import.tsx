"use client";

// T3 Menu Import review (CAP-3) - dropzone, extraction review, single commit.
// Nothing reaches the live menu before "Commit menu": upload only creates a
// draft, per-field edits PATCH that same draft, and commit is the one write
// that turns it into real menu items (and, server-side, completes the
// go-live checklist's menu_import step).
import { PartyPopper, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { commitMenuImport, MenuImportCommitResult, updateMenuImportItem, uploadMenuImport } from "./api";
import {
  canCommit,
  CONFIDENCE_LABEL,
  confidenceLevel,
  isAcceptedMenuFile,
  majorStringToPriceMinor,
  MENU_IMPORT_ACCEPT,
  MenuImportItem,
  priceMinorToMajorString,
  reviewedCount,
} from "./menu-import-state";

const UPLOAD_ERROR = "That file type isn't supported. Upload a CSV, XLSX spreadsheet, a photo (JPG/PNG) or a PDF of your menu.";
const GENERIC_FAILURE = "Something went wrong. Check your connection and try again.";

const CONFIDENCE_CLASS: Record<ReturnType<typeof confidenceLevel>, string> = {
  high: "border-status-active/40 bg-status-active/15 text-status-active",
  medium: "border-status-pending/40 bg-status-pending/15 text-status-pending",
  low: "border-status-error/40 bg-status-error/15 text-status-error",
};

type Phase = "dropzone" | "uploading" | "review" | "committing" | "success";

export function MenuImport() {
  const [phase, setPhase] = useState<Phase>("dropzone");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuImportItem[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<MenuImportCommitResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function flashToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleFile(file: File) {
    if (!isAcceptedMenuFile(file)) {
      setUploadError(UPLOAD_ERROR);
      return;
    }
    setUploadError(null);
    setPhase("uploading");
    try {
      const draft = await uploadMenuImport(file);
      setImportId(draft.importId);
      setItems(draft.items);
      setReviewed(new Set());
      setPhase("review");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : GENERIC_FAILURE);
      setPhase("dropzone");
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function toggleReviewed(itemId: string) {
    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // Optimistic per EXPERIENCE.md's routine-edit pattern: apply locally first,
  // then reconcile with the backend's fresh draft, rolling back on failure.
  async function handleFieldEdit(itemId: string, field: "name" | "shortName" | "category" | "priceMinor", value: string | number) {
    const previousItems = items;
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
    if (!importId) return;
    try {
      const draft = await updateMenuImportItem(importId, itemId, field, value);
      setItems(draft.items);
    } catch {
      setItems(previousItems);
      flashToast("That edit didn't save. Try again.");
    }
  }

  async function handleCommit() {
    if (!importId) return;
    setCommitError(null);
    setPhase("committing");
    try {
      const result = await commitMenuImport(importId);
      setCommitResult(result);
      setPhase("success");
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : GENERIC_FAILURE);
      setPhase("review");
    }
  }

  if (phase === "success") {
    return (
      <div
        data-testid="menu-import-success"
        className="flex flex-col items-center gap-3 rounded-xl border border-status-active/40 bg-card p-10 text-center"
      >
        <PartyPopper className="size-8 text-status-active" aria-hidden="true" />
        <h2 className="font-headline text-xl font-semibold">Your menu is in!</h2>
        <p className="text-sm text-muted-foreground">{commitResult?.items.length ?? items.length} items were added to your menu.</p>
        <Button asChild data-testid="menu-import-success-onboarding-link" className="mt-4">
          <Link href="/admin/onboarding">Back to setup</Link>
        </Button>
      </div>
    );
  }

  if (phase === "dropzone" || phase === "uploading") {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-xl font-semibold">Import your menu</h1>
          <p className="text-sm text-muted-foreground">Upload a spreadsheet, photo or PDF and we&apos;ll draft your menu for you to check.</p>
        </div>
        <div
          data-testid="menu-import-dropzone"
          role="button"
          tabIndex={0}
          aria-disabled={phase === "uploading"}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{phase === "uploading" ? "Reading your menu..." : "Drag a file here, or click to browse"}</p>
          <p className="text-xs text-muted-foreground">CSV, XLSX, photo (JPG/PNG) or PDF</p>
        </div>
        <input
          ref={fileInputRef}
          data-testid="menu-import-file-input"
          type="file"
          accept={MENU_IMPORT_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          disabled={phase === "uploading"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
        {uploadError && (
          <p role="alert" data-testid="menu-import-upload-error" className="text-sm text-error-soft">
            {uploadError}
          </p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-testid="menu-import-empty" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">We couldn&apos;t find any items in that file. Try a different one.</p>
        <Button
          data-testid="menu-import-start-over"
          variant="secondary"
          onClick={() => {
            setImportId(null);
            setPhase("dropzone");
          }}
        >
          Upload a different file
        </Button>
      </div>
    );
  }

  const reviewedTotal = reviewedCount(reviewed, items);
  const commitEnabled = canCommit(reviewed, items) && phase === "review";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-headline text-xl font-semibold">Review your imported menu</h1>
        <p className="text-sm text-muted-foreground">
          We drafted {items.length} item{items.length === 1 ? "" : "s"} - check anything flagged before adding it to your menu.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table data-testid="menu-import-table" className="w-full text-sm">
          <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Reviewed</th>
              <th className="px-4 py-3">Item name</th>
              <th className="px-4 py-3">Kitchen name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const overall = confidenceLevel(item.confidence.overall);
              return (
                <tr key={item.id} data-testid={`menu-import-row-${item.id}`} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      data-testid={`menu-import-row-${item.id}-reviewed`}
                      checked={reviewed.has(item.id)}
                      onChange={() => toggleReviewed(item.id)}
                      aria-label={`Mark ${item.name || "this item"} as reviewed`}
                      className="size-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      testId={`menu-import-row-${item.id}-name`}
                      value={item.name}
                      confidence={item.confidence.name}
                      onCommit={(value) => void handleFieldEdit(item.id, "name", value)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      testId={`menu-import-row-${item.id}-short-name`}
                      value={item.shortName}
                      confidence={item.confidence.shortName}
                      onCommit={(value) => void handleFieldEdit(item.id, "shortName", value)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      testId={`menu-import-row-${item.id}-category`}
                      value={item.category}
                      confidence={item.confidence.category}
                      onCommit={(value) => void handleFieldEdit(item.id, "category", value)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{item.currency}</span>
                        <input
                          data-testid={`menu-import-row-${item.id}-price`}
                          type="number"
                          step="0.01"
                          min="0"
                          key={item.priceMinor}
                          defaultValue={priceMinorToMajorString(item.priceMinor)}
                          onBlur={(event) => {
                            const priceMinor = majorStringToPriceMinor(event.target.value);
                            if (priceMinor !== null && priceMinor !== item.priceMinor) void handleFieldEdit(item.id, "priceMinor", priceMinor);
                          }}
                          className="w-24 rounded-md border border-border bg-input px-2 py-1 text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <ConfidenceHint testId={`menu-import-row-${item.id}-price-confidence`} score={item.confidence.price} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      data-testid={`menu-import-row-${item.id}-confidence`}
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[overall]}`}
                    >
                      {CONFIDENCE_LABEL[overall]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {commitError && (
        <p role="alert" data-testid="menu-import-commit-error" className="text-sm text-error-soft">
          {commitError}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p data-testid="menu-import-reviewed-count" className="text-sm text-muted-foreground">
          {reviewedTotal}/{items.length} reviewed
        </p>
        <Button
          data-testid="menu-import-commit"
          disabled={!commitEnabled}
          title={commitEnabled ? undefined : "Review every item before adding it to your menu."}
          onClick={() => void handleCommit()}
        >
          {phase === "committing" ? "Adding to your menu..." : "Commit menu"}
        </Button>
      </div>

      {toast && (
        <div role="status" data-testid="menu-import-toast" className="rounded-lg border border-status-error/40 bg-card px-4 py-2 text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

function EditableCell({
  testId,
  value,
  confidence,
  onCommit,
}: Readonly<{ testId: string; value: string; confidence: number; onCommit: (value: string) => void }>) {
  return (
    <div className="flex flex-col gap-1">
      <input
        data-testid={testId}
        type="text"
        defaultValue={value}
        key={value}
        onBlur={(event) => {
          if (event.target.value !== value) onCommit(event.target.value);
        }}
        className="w-full min-w-32 rounded-md border border-border bg-input px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <ConfidenceHint testId={`${testId}-confidence`} score={confidence} />
    </div>
  );
}

/** Only surfaces for fields worth double-checking - a high-confidence field stays uncluttered. */
function ConfidenceHint({ testId, score }: Readonly<{ testId: string; score: number }>) {
  const level = confidenceLevel(score);
  if (level === "high") return null;
  return (
    <span data-testid={testId} className={`text-xs ${level === "low" ? "text-status-error" : "text-status-pending"}`}>
      {CONFIDENCE_LABEL[level]} - double-check this
    </span>
  );
}
