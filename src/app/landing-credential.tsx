"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// A copyable credential value on the landing page. It sits above the card's
// stretched CTA link (z-10 + stopPropagation) so clicking it copies rather
// than navigating into the surface.

/** navigator.clipboard only exists in secure contexts (https/localhost); a demo opened over plain http on a LAN IP falls back to the legacy selection copy. */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

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
        void copyText(value).then((ok) => {
          if (!ok) return;
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="relative z-10 flex min-w-0 max-w-full items-center gap-1.5 rounded px-1 py-0.5 font-mono text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate">{value}</span>
      {copied ? (
        <Check aria-hidden="true" className="size-3 shrink-0 text-status-healthy" />
      ) : (
        <Copy aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
