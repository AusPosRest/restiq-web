"use client";

// 86 (out of stock) toggle (SPEC CAP-4 / EXPERIENCE.md): a single switch per
// row, immediate optimistic UI update, rollback-on-failure toast. Routine
// content edit per the SPEC's audit constraint - no reason prompt. Backend:
// PATCH .../availability, field `available` (verified against
// restiq-backend's items.controller.ts / items.service.ts).
import { useState } from "react";
import { setItemAvailability } from "../../api";
import { useToast } from "../toast";

export function EightySixToggle({
  itemId,
  available,
  itemName,
  onChanged,
}: Readonly<{ itemId: string; available: boolean; itemName: string; onChanged: (next: boolean) => void }>) {
  const [busy, setBusy] = useState(false);
  const pushToast = useToast();
  const is86d = !available;

  async function handleToggle() {
    const next = !available;
    onChanged(next);
    setBusy(true);
    try {
      await setItemAvailability(itemId, next);
    } catch {
      onChanged(available);
      pushToast({ kind: "error", message: `Couldn't update ${itemName || "that item"}. Try again.`, onRetry: () => void handleToggle() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={is86d}
      aria-label={is86d ? `Mark ${itemName || "this item"} available` : `Mark ${itemName || "this item"} 86'd (out of stock)`}
      data-testid={`item-86-toggle-${itemId}`}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        void handleToggle();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 ${
        is86d ? "bg-status-error" : "bg-accent"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-3.5 transform rounded-full bg-white transition-transform ${is86d ? "translate-x-[18px]" : "translate-x-1"}`}
      />
    </button>
  );
}
