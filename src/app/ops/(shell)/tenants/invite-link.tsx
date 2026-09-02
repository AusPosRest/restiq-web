"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// The raw invite token is returned exactly once by the API (no mailer exists
// in this prototype - restiq-backend#85), so this chip is the only place the
// accept link is ever visible. Copy it before leaving the page.
export function InviteLinkChip({ token }: Readonly<{ token: string }>) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/admin/invite/${token}`;

  return (
    <div data-testid="invite-link-chip" className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-left">
      <p className="text-xs font-semibold">Invite link - shown once, copy it now</p>
      <p className="mt-1 text-xs text-muted-foreground">
        No email is sent in this prototype. Share this link with the owner; it stops working if the invite is
        regenerated.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code data-testid="invite-link-url" className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
          {url}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="invite-link-copy"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
