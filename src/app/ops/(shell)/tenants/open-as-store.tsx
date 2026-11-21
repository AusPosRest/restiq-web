"use client";

// restiq-web#449 service mode: an operator opens one restaurant's owner console for support. The
// owner session is an httpOnly cookie on the restaurant's own address, so this console gets a
// 60-second handoff code and POSTs it there in a new tab, where /admin/auth/service redeems it.
// The code travels in a form body, never a URL (no history, logs or Referer).
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BASE_DOMAIN, TENANT_SLUG } from "@/lib/tenant-by-host";
import { opsApi, OpsApiError } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { useToast } from "../toast";

const HANDOFF_PATH = "/admin/auth/service";

/**
 * The restaurant's own address only when this console is itself served under the base domain;
 * anywhere else (localhost, a dev host, no slug yet) the same-origin path, which is where the
 * owner console lives there too.
 */
export function serviceHandoffUrl(slug: string | null, baseDomain: string | undefined, hostname: string): string {
  if (!slug || !TENANT_SLUG.test(slug) || !baseDomain || !BASE_DOMAIN.test(baseDomain)) return HANDOFF_PATH;
  const base = baseDomain.split(":")[0].toLowerCase();
  const host = hostname.toLowerCase();
  if (host !== base && !host.endsWith(`.${base}`)) return HANDOFF_PATH;
  return `https://${slug}.${baseDomain}${HANDOFF_PATH}`;
}

interface ServiceSession {
  code: string;
  slug: string | null;
  expiresInSeconds: number;
}

export function OpenAsStoreButton({
  tenantId,
  tenantName,
  status,
  className,
  variant = "default",
}: Readonly<{ tenantId: string; tenantName: string; status: string; className?: string; variant?: "default" | "outline" }>) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inactive = status === "inactive";

  async function confirm(reason: string) {
    // Opened now, inside the click, so popup blockers let it through; filled once the code arrives.
    const target = `restiq-service-${tenantId}-${Date.now()}`;
    const tab = window.open("about:blank", target);
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const session = await opsApi<ServiceSession>(`tenants/${tenantId}/service-session`, { method: "POST", body: JSON.stringify({ reason }) });
      const form = document.createElement("form");
      form.method = "post";
      form.action = serviceHandoffUrl(session.slug, process.env.NEXT_PUBLIC_BASE_DOMAIN, window.location.hostname);
      // A blocked popup leaves no tab to fill: open the store in this one rather than lose the code.
      form.target = tab ? target : "_self";
      form.hidden = true;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "code";
      input.value = session.code;
      form.append(input);
      document.body.append(form);
      form.submit();
      form.remove();
      setOpen(false);
    } catch (error) {
      tab?.close();
      toast({
        kind: "error",
        message:
          error instanceof OpsApiError && error.status === 409
            ? "This tenant is inactive. Reactivate it first."
            : error instanceof OpsApiError
              ? error.message
              : "Couldn't open the store. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  // The tenants table row navigates on click and Enter; React events bubble through the dialog's
  // portal too, so stop them here rather than on the button alone.
  return (
    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Button
        type="button"
        variant={variant}
        size={variant === "outline" ? "sm" : "default"}
        data-testid={`open-as-store-${tenantId}`}
        disabled={inactive}
        title={inactive ? "Reactivate this tenant to open it" : undefined}
        onClick={() => setOpen(true)}
        className={className}
      >
        <ExternalLink aria-hidden="true" /> Open as store
      </Button>
      <ConfirmReasonDialog
        open={open}
        title={`Open ${tenantName} as store`}
        description="You will enter this restaurant's owner console in service mode, in a new tab. Everything you change there is recorded under your name. The session ends after 1 hour, or when you sign out of the Platform Console."
        verb="Open as store"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </span>
  );
}
