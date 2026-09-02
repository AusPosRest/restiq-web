"use client";

// Mirrors ops/(shell)/tenants/invite-link.tsx's InviteLinkChip - AD-4 keeps
// admin and ops components unshared across route trees, so this is an
// admin-local equivalent rather than a shared import.
//
// The raw PIN is returned exactly once by the API (restiq-backend#114): once
// this chip is dismissed, an owner can only see it again by revoking and
// re-issuing. This chip is the only place it's ever visible.
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface StaffPinChipProps {
  name: string;
  pin: string;
  onDismiss: () => void;
}

export function StaffPinChip({ name, pin, onDismiss }: Readonly<StaffPinChipProps>) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions, non-secure context) - copy button stays usable, just inert
    }
  }

  return (
    <div data-testid="staff-pin-chip" className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-xs font-semibold">PIN for {name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Shown once - copy it before you dismiss.</p>
      <div className="mt-2 flex items-center gap-3">
        <code data-testid="staff-pin-chip-value" className="rounded bg-muted px-3 py-1 font-mono text-2xl tracking-[0.3em]">
          {pin}
        </code>
        <Button type="button" size="sm" variant="outline" data-testid="staff-pin-chip-copy" onClick={() => void handleCopy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" variant="ghost" data-testid="staff-pin-chip-dismiss" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
