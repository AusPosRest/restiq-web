"use client";

// The non-capability tabs of Tenant Detail (O5). Every mutation confirms
// through the reason dialog; the reason lands in the audit trail.
import { MailPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, TenantDetail } from "../../api";
import { InviteLinkChip } from "../invite-link";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { StatusBadge } from "../../status-badge";
import { useToast } from "../../toast";

interface TabProps {
  detail: TenantDetail;
  onMutated: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  id,
  label,
  value,
  onChange,
}: Readonly<{ id: string; label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <div>
      <label htmlFor={id} className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input id={id} data-testid={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASSES} />
    </div>
  );
}

function StatCard({ label, value, testId }: Readonly<{ label: string; value: string; testId: string }>) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-5" data-testid={testId}>
      <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// --- Overview: at-a-glance stats + editable business basics.

export function OverviewTab({ detail, onMutated }: Readonly<TabProps>) {
  const toast = useToast();
  const { tenant } = detail;
  const [form, setForm] = useState({
    name: tenant.name,
    registeredAddress: tenant.registeredAddress,
    contactName: tenant.contactName,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
  });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const changed = Object.entries(form).filter(
    ([key, value]) => value !== tenant[key as keyof typeof form] && value.trim() !== "",
  );

  async function save(reason: string) {
    setBusy(true);
    try {
      await opsApi(`tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...Object.fromEntries(changed), reason }),
      });
      setConfirming(false);
      toast({ kind: "success", message: "Business details updated." });
      onMutated();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The update failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Outlets" value={String(detail.outlets.length)} testId="overview-outlets" />
        <StatCard label="Roles" value={String(detail.rolesCount)} testId="overview-roles" />
        <StatCard label="Plan" value={`${tenant.plan} · ${tenant.billingPeriod}`} testId="overview-plan" />
        <StatCard label="Region" value={tenant.region} testId="overview-region" />
      </div>

      <form
        className="rounded-lg border border-border/40 bg-card p-5"
        data-testid="overview-basics-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed.length > 0) setConfirming(true);
        }}
      >
        <h2 className="font-headline text-lg font-semibold">Business details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="basics-name" label="Company name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field
            id="basics-contact-name"
            label="Contact name"
            value={form.contactName}
            onChange={(contactName) => setForm({ ...form, contactName })}
          />
          <Field
            id="basics-contact-email"
            label="Contact email"
            value={form.contactEmail}
            onChange={(contactEmail) => setForm({ ...form, contactEmail })}
          />
          <Field
            id="basics-contact-phone"
            label="Contact phone"
            value={form.contactPhone}
            onChange={(contactPhone) => setForm({ ...form, contactPhone })}
          />
          <div className="sm:col-span-2">
            <Field
              id="basics-address"
              label="Registered address"
              value={form.registeredAddress}
              onChange={(registeredAddress) => setForm({ ...form, registeredAddress })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" data-testid="basics-save" disabled={changed.length === 0}>
            Save changes
          </Button>
        </div>
      </form>

      <ConfirmReasonDialog
        open={confirming}
        title={`Update ${tenant.name}`}
        description={`${changed.length} field${changed.length === 1 ? "" : "s"} will change on the tenant record.`}
        verb="Save changes"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void save(reason)}
      />
    </div>
  );
}

// --- Outlets: read-only directory of the tenant's outlets.

export function OutletsTab({ detail }: Readonly<{ detail: TenantDetail }>) {
  if (detail.outlets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground" data-testid="outlets-empty">
        No outlets yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card" data-testid="outlets-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="h-12 border-b border-border/40">
            {["Outlet", "Brand", "Type", "Address", "Timezone"].map((heading) => (
              <th key={heading} className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.outlets.map((outlet) => (
            <tr key={outlet.id} className="h-12 border-b border-border/20 last:border-b-0">
              <td className="px-4 font-medium">{outlet.name}</td>
              <td className="px-4 text-muted-foreground">{outlet.brandName}</td>
              <td className="px-4 text-muted-foreground">{outlet.type.replace(/_/g, " ")}</td>
              <td className="px-4 text-muted-foreground">{outlet.address}</td>
              <td className="px-4 text-muted-foreground">{outlet.timezone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Branding: the tenant's design-token overrides as editable JSON.

export function BrandingTab({ detail, onMutated }: Readonly<TabProps>) {
  const toast = useToast();
  const { tenant } = detail;
  const [text, setText] = useState(() => JSON.stringify(tenant.brandingTokens, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  function parseTokens(): Record<string, string> | null {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
      for (const value of Object.values(parsed)) {
        if (typeof value !== "string") throw new Error();
      }
      return parsed as Record<string, string>;
    } catch {
      setParseError("Branding tokens must be a JSON object of string values.");
      return null;
    }
  }

  async function save(reason: string) {
    const tokens = parseTokens();
    if (!tokens) {
      setConfirming(false);
      return;
    }
    setBusy(true);
    try {
      await opsApi(`tenants/${tenant.id}/branding`, { method: "PUT", body: JSON.stringify({ tokens, reason }) });
      setConfirming(false);
      toast({ kind: "success", message: "Branding tokens updated." });
      onMutated();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The branding update failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-lg border border-border/40 bg-card p-5">
      <h2 className="font-headline text-lg font-semibold">Branding tokens</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Design-token overrides applied to this tenant&apos;s guest-facing surfaces (logo URL, accent color, ...).
      </p>
      <textarea
        data-testid="branding-tokens"
        value={text}
        rows={10}
        spellCheck={false}
        aria-invalid={parseError ? true : undefined}
        onChange={(event) => {
          setText(event.target.value);
          setParseError(null);
        }}
        className={`mt-4 w-full rounded-lg border bg-input px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          parseError ? "border-status-critical" : "border-border"
        }`}
      />
      {parseError && (
        <p role="alert" data-testid="branding-error" className="mt-1.5 text-sm text-error-soft">
          {parseError}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          data-testid="branding-save"
          onClick={() => {
            if (parseTokens()) setConfirming(true);
          }}
        >
          Save branding
        </Button>
      </div>

      <ConfirmReasonDialog
        open={confirming}
        title={`Update branding for ${tenant.name}`}
        description="The new tokens replace the tenant's current branding overrides."
        verb="Save branding"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void save(reason)}
      />
    </div>
  );
}

// --- Owners: contact + owner invite with audited regeneration.

export function OwnersTab({ detail }: Readonly<{ detail: TenantDetail }>) {
  const toast = useToast();
  const { tenant } = detail;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  // The regenerate response already carries the fresh invite, so render from
  // it locally instead of refetching the whole detail - a refetch flips the
  // page to its loading skeleton, which unmounts this tab and loses the
  // shown-once inviteToken (restiq-web#87).
  const [freshInvite, setFreshInvite] = useState<TenantDetail["ownerInvite"]>(null);
  const ownerInvite = freshInvite ?? detail.ownerInvite;

  async function regenerate(reason: string) {
    setBusy(true);
    try {
      const body = await opsApi<{ invite: NonNullable<TenantDetail["ownerInvite"]>; inviteToken: string }>(
        `tenants/${tenant.id}/owner-invite/regenerate`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      setInviteToken(body.inviteToken);
      setFreshInvite(body.invite);
      setConfirming(false);
      toast({ kind: "success", message: "Owner invite regenerated - the previous link no longer works." });
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The invite could not be regenerated." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="font-headline text-lg font-semibold">Primary contact</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</dt>
            <dd className="mt-1">{tenant.contactName}</dd>
          </div>
          <div>
            <dt className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</dt>
            <dd className="mt-1">{tenant.contactEmail}</dd>
          </div>
          <div>
            <dt className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</dt>
            <dd className="mt-1">{tenant.contactPhone}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border/40 bg-card p-5" data-testid="owner-invite-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-lg font-semibold">Owner invite</h2>
            {ownerInvite ? (
              <div className="mt-3 text-sm">
                <p>
                  {ownerInvite.firstName} {ownerInvite.lastName}{" "}
                  <span className="text-muted-foreground">&lt;{ownerInvite.email}&gt;</span>
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <StatusBadge status={ownerInvite.status} testId="owner-invite-status" />
                  <span className="text-muted-foreground">
                    {ownerInvite.status === "pending" ? "expires" : "expired"}{" "}
                    {new Date(ownerInvite.expiresAt).toLocaleString(undefined, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                {inviteToken && <InviteLinkChip token={inviteToken} />}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground" data-testid="owner-invite-none">
                No owner invite exists for this tenant.
              </p>
            )}
          </div>
          {ownerInvite && (
            <Button variant="secondary" data-testid="owner-invite-regenerate" onClick={() => setConfirming(true)}>
              <MailPlus aria-hidden="true" /> Regenerate invite
            </Button>
          )}
        </div>
      </div>

      <ConfirmReasonDialog
        open={confirming}
        title="Regenerate owner invite"
        description={`A new invite is issued to ${ownerInvite?.email ?? "the owner"} and the previous link stops working immediately.`}
        verb="Regenerate invite"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void regenerate(reason)}
      />
    </div>
  );
}
