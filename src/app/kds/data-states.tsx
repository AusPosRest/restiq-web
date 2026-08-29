// Shared pieces of the KDS surface's error/loading states. Mirrors /pos's
// data-states.tsx (not imported - route trees never cross, AD-4), sized to
// this surface's 56px touch-target floor (DESIGN.md: "larger than POS's 44px
// floor - gloved hands, arm's-length reach") rather than reusing POS's own.
import { AlertTriangle } from "lucide-react";

export function LoadErrorPanel({
  message,
  onRetry,
  testId,
}: Readonly<{ message: string; onRetry: () => void; testId: string }>) {
  return (
    <div data-testid={testId} role="alert" className="flex items-center gap-3 rounded-lg border border-ticket-urgent/40 bg-card px-4 py-3 text-sm">
      <AlertTriangle className="size-4 shrink-0 text-ticket-urgent" aria-hidden="true" />
      <span className="text-muted-foreground">{message}</span>
      <button
        type="button"
        data-testid={`${testId}-retry`}
        onClick={onRetry}
        className="ml-auto flex h-14 items-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Retry
      </button>
    </div>
  );
}

export function Skeleton({ className = "" }: Readonly<{ className?: string }>) {
  return <div className={`animate-pulse rounded-lg bg-card ${className}`} data-testid="kds-skeleton" />;
}
