// Shared pieces of the five-state pattern (EXPERIENCE.md): the inline
// load-error panel with retry. Mirrors /admin's data-states.tsx (not
// imported - the pos/admin route trees never import from each other, AD-4),
// restyled to POS's own status-alert token (DESIGN.md: red = alert/void).
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadErrorPanel({
  message,
  onRetry,
  testId,
}: Readonly<{ message: string; onRetry: () => void; testId: string }>) {
  return (
    <div
      data-testid={testId}
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm"
    >
      <AlertTriangle className="size-4 shrink-0 text-status-alert" aria-hidden="true" />
      <span className="text-muted-foreground">{message}</span>
      <Button variant="secondary" size="sm" data-testid={`${testId}-retry`} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
