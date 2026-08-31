// Shared pieces of the five-state pattern (EXPERIENCE.md): skeletons that
// match content geometry and the inline load-error panel with retry. The
// shell stays alive around them.
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
      className="flex flex-col items-center gap-3 rounded-lg border border-status-critical/40 bg-card px-6 py-10 text-center"
    >
      <AlertTriangle className="size-6 text-status-critical" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="secondary" size="sm" data-testid={`${testId}-retry`} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
