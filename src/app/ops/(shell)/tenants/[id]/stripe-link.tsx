"use client";

// A single-use Stripe link ops hands to the owner (#425): read-only URL, Copy, Open in a
// new tab, and when it expires.
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DATE_LOCALE } from "@/lib/datetime";
import type { StripeLink } from "../../api";
import { useToast } from "../../toast";

export function StripeLinkResult({ link, testId, note }: Readonly<{ link: StripeLink; testId: string; note: string }>) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast({ kind: "success", message: "Link copied." });
    } catch {
      toast({ kind: "error", message: "Could not copy. Select the link and copy it by hand." });
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border/40 p-4" data-testid={testId}>
      <label htmlFor={`${testId}-url`} className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Link
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`${testId}-url`}
          data-testid={`${testId}-url`}
          readOnly
          value={link.url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="button" variant="secondary" size="sm" data-testid={`${testId}-copy`} onClick={() => void copy()}>
          <Copy aria-hidden="true" /> Copy
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={link.url} target="_blank" rel="noopener noreferrer" data-testid={`${testId}-open`}>
            <ExternalLink aria-hidden="true" /> Open
          </a>
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground" data-testid={`${testId}-expiry`}>
        Expires {new Date(link.expiresAt).toLocaleString(DATE_LOCALE, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
