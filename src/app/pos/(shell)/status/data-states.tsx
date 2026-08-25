// Shared pieces of the five-state pattern (EXPERIENCE.md): skeletons that
// match content geometry and the inline load-error panel with retry. Mirrors
// shift/data-states.tsx's shape exactly - (shell)/data-states.tsx one level
// up only exports LoadErrorPanel, no Skeleton, so this subtree keeps its own
// small copy rather than reaching past it, same precedent shift/ already set.
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Skeleton({ className, ...props }: Readonly<React.ComponentProps<"div">>) {
  return <div aria-hidden="true" {...props} className={`animate-pulse rounded-md bg-accent ${className ?? ""}`} />;
}

export function LoadErrorPanel({
  message,
  onRetry,
  testId,
}: Readonly<{ message: string; onRetry: () => void; testId: string }>) {
  return (
    <div
      data-testid={testId}
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-status-alert/40 bg-card px-6 py-10 text-center"
    >
      <AlertTriangle className="size-6 text-status-alert" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="secondary" size="sm" data-testid={`${testId}-retry`} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
