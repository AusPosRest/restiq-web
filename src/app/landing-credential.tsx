"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// A copyable credential value on the landing page. It sits above the card's
// stretched CTA link (z-10 + stopPropagation) so clicking it copies rather
// than navigating into the surface.
export function CredentialValue({ label, value }: Readonly<{ label: string; value: string }>) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      data-testid={`landing-copy-${label}`}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}: ${value}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined,
        );
      }}
      className="relative z-10 flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 font-mono text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check aria-hidden="true" className="size-3 shrink-0 text-status-healthy" />
      ) : (
        <Copy aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
