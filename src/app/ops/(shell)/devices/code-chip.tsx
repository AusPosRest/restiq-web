"use client";

// Code Chip (EXPERIENCE.md O6): an enrolment code with a live TTL countdown;
// once it expires the chip grays out and offers one-click regenerate.
import { Check, Copy, RotateCw, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Whole seconds remaining until `expiresAt`, floored at 0. Pure - unit-tested. */
export function secondsRemaining(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function CodeChip({
  code,
  expiresAt,
  onRegenerate,
  regenerating,
}: Readonly<{ code: string; expiresAt: string; onRegenerate: () => void; regenerating?: boolean }>) {
  const [remaining, setRemaining] = useState(() => secondsRemaining(expiresAt, Date.now()));
  const [copied, setCopied] = useState(false);

  // expiresAt only ever changes via a fresh code (the dialog keys CodeChip by
  // code), so the mount-time useState initializer already has the right
  // value - the effect only needs to keep it ticking.
  useEffect(() => {
    const id = setInterval(() => setRemaining(secondsRemaining(expiresAt, Date.now())), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = remaining <= 0;

  return (
    <div data-testid="code-chip" className="rounded-lg border border-border/60 bg-card p-5 text-center">
      <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enrolment code</p>
      <div
        className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-5 py-3 font-mono text-2xl font-bold tracking-widest ${
          expired ? "border-border text-muted-foreground/50" : "border-primary/50 text-primary"
        }`}
      >
        <span data-testid="code-chip-value">{code}</span>
        {!expired && (
          <button
            type="button"
            aria-label="Copy code"
            data-testid="code-chip-copy"
            onClick={() => {
              void navigator.clipboard?.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm">
        {expired ? (
          <span data-testid="code-chip-expired" className="font-semibold text-status-critical">
            Expired
          </span>
        ) : (
          <span data-testid="code-chip-countdown" className="flex items-center gap-1.5 text-status-healthy">
            <Timer className="size-3.5" aria-hidden="true" /> Expires in {formatCountdown(remaining)} · one-time use
          </span>
        )}
      </p>

      {expired && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          data-testid="code-chip-regenerate"
          disabled={regenerating}
          onClick={onRegenerate}
        >
          <RotateCw aria-hidden="true" /> {regenerating ? "Regenerating..." : "Regenerate"}
        </Button>
      )}
    </div>
  );
}
