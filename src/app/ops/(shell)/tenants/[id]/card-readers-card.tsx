"use client";

// Payments tab > Card readers (restiq-web#429): the restaurant's Stripe smart readers, live
// status from Stripe, register one with its pairing code, remove one (audited).
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deviceTypeLabel, type CardReaderView } from "@/lib/card-readers";
import { opsApi, OpsApiError } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { useToast } from "../../toast";
import { useOpsLoad } from "../../use-ops-load";
import { emptyRegisterForm, SIMULATED_CODE, validateRegisterForm, type RegisterForm } from "./card-readers-state";

type OutletOption = { id: string; name: string; address: string };

const TH = "font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const INPUT = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const LABEL = "font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const DOT: Record<CardReaderView["status"], string> = { online: "bg-status-healthy", offline: "bg-status-critical", unknown: "bg-muted-foreground" };

export function CardReadersCard({ tenantId, outlets, stripeActive }: Readonly<{ tenantId: string; outlets: OutletOption[]; stripeActive: boolean }>) {
  const toast = useToast();
  const { loading, failed, data, retry } = useOpsLoad<{ readers: CardReaderView[] }>(`tenants/${tenantId}/card-readers`);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState<CardReaderView | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(reason: string) {
    if (!removing) return;
    setBusy(true);
    try {
      await opsApi(`tenants/${tenantId}/card-readers/${removing.id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
      toast({ kind: "success", message: `${removing.label} removed.` });
      setRemoving(null);
      retry();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The reader could not be removed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/40 bg-card p-5" data-testid="card-readers-card" aria-labelledby="card-readers-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="card-readers-heading" className="font-headline text-lg font-semibold">
            Card readers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Stripe smart readers the POS sends card payments to.</p>
        </div>
        <Button size="sm" data-testid="card-readers-register" disabled={!stripeActive || outlets.length === 0} onClick={() => setRegistering(true)}>
          <Plus aria-hidden="true" /> Register reader
        </Button>
      </div>
      {!stripeActive && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="card-readers-inactive">
          Readers can be registered once the Stripe account above is active.
        </p>
      )}

      <div className="mt-4">
        {failed ? (
          <LoadErrorPanel message="Card readers could not be loaded." onRetry={retry} testId="card-readers-error" />
        ) : loading || !data ? (
          <Skeleton className="h-20 w-full" data-testid="card-readers-loading" />
        ) : data.readers.length === 0 ? (
          <p data-testid="card-readers-empty" className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No readers yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-sm" data-testid="card-readers-table">
              <thead>
                <tr className="h-11 border-b border-border/40">
                  <th className={TH}>Reader</th>
                  <th className={TH}>Outlet</th>
                  <th className={TH}>Serial</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {data.readers.map((reader) => (
                  <tr key={reader.id} data-testid={`card-reader-${reader.id}`} className="border-b border-border/20 last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{reader.label}</span>
                      {reader.simulated && (
                        <span className="font-label ml-2 rounded-[6px] border border-status-info/50 bg-status-info/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-status-info">
                          Simulated
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground">{deviceTypeLabel(reader.deviceType)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{reader.outletName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{reader.serialNumber ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5" data-testid={`card-reader-status-${reader.id}`}>
                        <span aria-hidden="true" className={`size-2 rounded-full ${DOT[reader.status]}`} />
                        {reader.status === "unknown" ? "Unknown" : reader.status === "online" ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid={`card-reader-remove-${reader.id}`}
                        className="text-status-critical hover:bg-status-critical/10"
                        onClick={() => setRemoving(reader)}
                      >
                        <Trash2 aria-hidden="true" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {registering && (
        <RegisterReaderDialog
          tenantId={tenantId}
          outlets={outlets}
          onClose={() => setRegistering(false)}
          onRegistered={(label) => {
            setRegistering(false);
            toast({ kind: "success", message: `${label} registered.` });
            retry();
          }}
        />
      )}

      <ConfirmReasonDialog
        open={removing !== null}
        title={`Remove ${removing?.label ?? "this reader"}?`}
        description="The reader is deleted at Stripe too. The POS stops sending payments to it straight away; to use it again, register it with a new pairing code."
        verb="Remove reader"
        destructive
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={(reason) => void remove(reason)}
      />
    </section>
  );
}

function RegisterReaderDialog({
  tenantId,
  outlets,
  onClose,
  onRegistered,
}: Readonly<{ tenantId: string; outlets: OutletOption[]; onClose: () => void; onRegistered: (label: string) => void }>) {
  const [form, setForm] = useState<RegisterForm>(() => emptyRegisterForm(outlets.length === 1 ? outlets[0].id : ""));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const checked = validateRegisterForm(form);
  const formError = "error" in checked ? checked.error : null;

  function set(patch: Partial<RegisterForm>) {
    setApiError(null);
    setForm((f) => ({ ...f, ...patch }));
  }

  async function submit() {
    setTouched(true);
    if ("error" in checked) return;
    setBusy(true);
    try {
      await opsApi(`tenants/${tenantId}/card-readers`, { method: "POST", body: JSON.stringify(checked) });
      onRegistered(checked.label);
    } catch (error) {
      if (error instanceof OpsApiError && error.code === "address_required") {
        // First reader at this outlet: Stripe needs the outlet's address for its location.
        const address = outlets.find((o) => o.id === form.outletId)?.address ?? "";
        set({ needsAddress: true, line1: form.line1 || address });
        setTouched(false);
        setApiError("This is the outlet's first reader. Stripe needs the outlet's address once.");
      } else {
        setApiError(error instanceof OpsApiError ? error.message : "The reader could not be registered.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="register-reader-dialog"
          className="ops-theme fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Register a card reader</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">The reader joins this restaurant&apos;s Stripe account at the outlet you pick.</Dialog.Description>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="register-reader-outlet" className={LABEL}>
                Outlet
              </label>
              <select
                id="register-reader-outlet"
                data-testid="register-reader-outlet"
                value={form.outletId}
                disabled={form.needsAddress}
                onChange={(event) => set({ outletId: event.target.value })}
                className={`${INPUT} h-10`}
              >
                <option value="">Select an outlet...</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="register-reader-label" className={LABEL}>
                Name
              </label>
              <input id="register-reader-label" data-testid="register-reader-label" placeholder="Counter 1" maxLength={60} value={form.label} onChange={(event) => set({ label: event.target.value })} className={INPUT} />
            </div>
            <div>
              <label htmlFor="register-reader-code" className={LABEL}>
                Registration code
              </label>
              <input
                id="register-reader-code"
                data-testid="register-reader-code"
                aria-describedby="register-reader-code-hint"
                autoComplete="off"
                disabled={form.simulated}
                value={form.simulated ? SIMULATED_CODE : form.registrationCode}
                onChange={(event) => set({ registrationCode: event.target.value })}
                className={INPUT}
              />
              <p id="register-reader-code-hint" className="mt-1 text-xs text-muted-foreground">
                Shown on the reader: Settings → Generate pairing code
              </p>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="register-reader-simulated"
                  checked={form.simulated}
                  onChange={(event) => set({ simulated: event.target.checked })}
                  className="size-4 rounded border-border focus-visible:ring-2 focus-visible:ring-ring"
                />
                Use a simulated reader (sandbox)
              </label>
            </div>

            {form.needsAddress && (
              <fieldset className="grid gap-3" data-testid="register-reader-address">
                <legend className={LABEL}>Outlet address</legend>
                <input aria-label="Street" placeholder="Street" data-testid="register-reader-line1" value={form.line1} onChange={(event) => set({ line1: event.target.value })} className={INPUT} />
                <div className="grid grid-cols-3 gap-2">
                  <input aria-label="City" placeholder="City" data-testid="register-reader-city" value={form.city} onChange={(event) => set({ city: event.target.value })} className={INPUT} />
                  <input aria-label="State" placeholder="State" data-testid="register-reader-state" value={form.state} onChange={(event) => set({ state: event.target.value })} className={INPUT} />
                  <input aria-label="Postcode" placeholder="Postcode" inputMode="numeric" data-testid="register-reader-postcode" value={form.postcode} onChange={(event) => set({ postcode: event.target.value })} className={INPUT} />
                </div>
              </fieldset>
            )}

            {(apiError || (touched && formError)) && (
              <p role="alert" className="text-sm text-status-critical" data-testid="register-reader-error">
                {apiError ?? formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="register-reader-cancel" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" data-testid="register-reader-submit" disabled={busy}>
                {busy ? "Registering..." : "Register reader"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
