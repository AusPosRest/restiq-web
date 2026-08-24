"use client";

// Per-outlet capability switch (CAP-10): optimistic with rollback-on-failure
// toast, no reason prompt - capability toggles aren't in the SPEC's named
// security-relevant list (role change, PIN revoke, price change), so this is
// a routine edit. Same visual/interaction shape as menu's EightySixToggle.
import { useState } from "react";
import { setOutletCapability } from "../../api";
import { useToast } from "../toast";

export function CapabilityToggle({
  outletId,
  capabilityKey,
  label,
  enabled,
  onChanged,
}: Readonly<{ outletId: string; capabilityKey: string; label: string; enabled: boolean; onChanged: (next: boolean) => void }>) {
  const [busy, setBusy] = useState(false);
  const pushToast = useToast();

  async function handleToggle() {
    const next = !enabled;
    onChanged(next);
    setBusy(true);
    try {
      await setOutletCapability(outletId, capabilityKey, next);
    } catch {
      onChanged(enabled);
      pushToast({ kind: "error", message: `Couldn't update ${label}. Try again.`, onRetry: () => void handleToggle() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? `Turn off ${label}` : `Turn on ${label}`}
      data-testid={`capability-toggle-${capabilityKey}`}
      disabled={busy}
      onClick={() => void handleToggle()}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 ${
        enabled ? "bg-status-active" : "bg-accent"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-3.5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-1"}`}
      />
    </button>
  );
}
