"use client";

// PE-32: the setup checklist sits outside the owner console's shell; it still carries the
// RESTIQ wordmark, greets the restaurant by name (and shows TEST for a Test-mode tenant, #213).
import { TestModeBadge } from "@/components/test-mode-badge";
import { useAdminLoad } from "./(shell)/use-admin-load";

export function OwnerSetupHeader() {
  const tenant = useAdminLoad<{ name: string; testMode: boolean }>("tenant").data;
  return (
    <header className="mb-8 flex flex-col gap-1" data-testid="owner-setup-header">
      <p className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight text-primary">
        RESTIQ
        {tenant?.testMode && <TestModeBadge testId="owner-setup-test-badge" />}
      </p>
      {tenant && (
        <p className="text-sm text-muted-foreground" data-testid="owner-setup-greeting">
          Welcome, {tenant.name}
        </p>
      )}
    </header>
  );
}
