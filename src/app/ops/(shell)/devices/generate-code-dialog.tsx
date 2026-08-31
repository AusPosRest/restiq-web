"use client";

// O6 "Generate enrolment code" drawer: pick tenant, outlet, device type, then
// hand back a one-time code as a Code Chip. Fixed-tenant mode (Tenant
// Detail's Devices tab) skips the tenant picker and reuses the outlets
// already loaded on that page - no extra fetch.
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, TenantDetail } from "../api";
import { useToast } from "../toast";
import { CodeChip } from "./code-chip";
import { DEVICE_TYPE_LABELS, DEVICE_TYPE_OPTIONS } from "./table-state";

export interface TenantOption {
  id: string;
  name: string;
}

interface GenerateCodeDialogProps {
  open: boolean;
  onClose: () => void;
  tenants: TenantOption[];
  fixedTenant?: { id: string; name: string; outlets: Array<{ id: string; name: string }> };
}

const SELECT_CLASSES =
  "h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <label className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function GenerateCodeDialog(props: Readonly<GenerateCodeDialogProps>) {
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ onClose, tenants, fixedTenant }: Readonly<GenerateCodeDialogProps>) {
  const toast = useToast();
  const [tenantId, setTenantId] = useState(fixedTenant?.id ?? "");
  const [outlets, setOutlets] = useState(fixedTenant?.outlets ?? []);
  const [outletId, setOutletId] = useState("");
  const [deviceType, setDeviceType] = useState<string>(DEVICE_TYPE_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);

  useEffect(() => {
    if (fixedTenant || !tenantId) return;
    void opsApi<TenantDetail>(`tenants/${tenantId}`).then((detail) => setOutlets(detail.outlets));
  }, [tenantId, fixedTenant]);

  async function generate() {
    if (!tenantId || !outletId) return;
    setBusy(true);
    try {
      const res = await opsApi<{ code: string; expiresAt: string }>("devices/enrolment-codes", {
        method: "POST",
        body: JSON.stringify({ tenantId, outletId, deviceType }),
      });
      setResult(res);
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not generate an enrolment code." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="generate-code-dialog"
          className="ops-theme fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-headline text-lg font-semibold">Generate enrolment code</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              data-testid="generate-code-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4">
            <Field label="Tenant">
              {fixedTenant ? (
                <p data-testid="generate-code-tenant-fixed" className="rounded-lg border border-border bg-input px-3 py-2 text-sm">
                  {fixedTenant.name}
                </p>
              ) : (
                <select
                  data-testid="generate-code-tenant"
                  value={tenantId}
                  disabled={result !== null}
                  onChange={(event) => {
                    setTenantId(event.target.value);
                    setOutlets([]);
                    setOutletId("");
                  }}
                  className={SELECT_CLASSES}
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Outlet">
              <select
                data-testid="generate-code-outlet"
                value={outletId}
                disabled={result !== null || !tenantId}
                onChange={(event) => setOutletId(event.target.value)}
                className={SELECT_CLASSES}
              >
                <option value="">Select an outlet...</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Device Type">
              <select
                data-testid="generate-code-type"
                value={deviceType}
                disabled={result !== null}
                onChange={(event) => setDeviceType(event.target.value)}
                className={SELECT_CLASSES}
              >
                {DEVICE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {DEVICE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            {result && (
              <CodeChip key={result.code} code={result.code} expiresAt={result.expiresAt} onRegenerate={() => void generate()} regenerating={busy} />
            )}
          </div>

          <div className="mt-6 flex justify-end">
            {result ? (
              <Button data-testid="generate-code-done" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button data-testid="generate-code-submit" disabled={!tenantId || !outletId || busy} onClick={() => void generate()}>
                {busy ? "Generating..." : "Generate code"}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
