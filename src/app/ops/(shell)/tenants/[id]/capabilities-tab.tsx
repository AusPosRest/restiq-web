"use client";

// Capability toggles: confirm-with-reason first, then optimistic flip with
// rollback + failure toast if the write is rejected (EXPERIENCE.md O5 note).
import { useState } from "react";
import { opsApi, OpsApiError } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { useToast } from "../../toast";

export const CAPABILITY_LABELS: Record<string, string> = {
  tables_floor_plan: "Tables and floor plan",
  kot_kds: "KOT and KDS",
  coursing: "Coursing",
  aggregators: "Aggregators",
  reservations: "Reservations",
  self_order_qr: "Self-order QR",
};

export function CapabilitiesTab({
  tenantId,
  capabilities,
}: Readonly<{ tenantId: string; capabilities: Array<{ key: string; enabled: boolean }> }>) {
  const toast = useToast();
  const [enabledByKey, setEnabledByKey] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(capabilities.map((capability) => [capability.key, capability.enabled])),
  );
  const [pending, setPending] = useState<{ key: string; enabled: boolean } | null>(null);

  function apply(key: string, enabled: boolean, reason: string) {
    setPending(null);
    // Optimistic: flip now, roll back if the API rejects it.
    setEnabledByKey((current) => ({ ...current, [key]: enabled }));
    void opsApi(`tenants/${tenantId}/capabilities/${key}`, {
      method: "PUT",
      body: JSON.stringify({ enabled, reason }),
    }).catch((error: unknown) => {
      setEnabledByKey((current) => ({ ...current, [key]: !enabled }));
      toast({
        kind: "error",
        message:
          error instanceof OpsApiError && error.message
            ? `${CAPABILITY_LABELS[key] ?? key}: ${error.message}`
            : `${CAPABILITY_LABELS[key] ?? key} could not be updated.`,
        onRetry: () => apply(key, enabled, reason),
      });
    });
  }

  return (
    <div className="max-w-2xl rounded-lg border border-border/40 bg-card" data-testid="capabilities-list">
      <ul className="divide-y divide-border/40">
        {capabilities.map(({ key }) => {
          const enabled = enabledByKey[key] ?? false;
          return (
            <li key={key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{CAPABILITY_LABELS[key] ?? key}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={CAPABILITY_LABELS[key] ?? key}
                data-testid={`capability-toggle-${key}`}
                onClick={() => setPending({ key, enabled: !enabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  enabled ? "bg-primary" : "bg-accent"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 size-5 rounded-full bg-foreground transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <ConfirmReasonDialog
        open={pending !== null}
        title={`${pending?.enabled ? "Enable" : "Disable"} ${pending ? (CAPABILITY_LABELS[pending.key] ?? pending.key) : ""}`}
        description={
          pending?.enabled
            ? "The feature becomes available to this tenant immediately."
            : "The feature is switched off for this tenant immediately."
        }
        verb={pending?.enabled ? "Enable" : "Disable"}
        destructive={pending ? !pending.enabled : false}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => {
          if (pending) apply(pending.key, pending.enabled, reason);
        }}
      />
    </div>
  );
}
