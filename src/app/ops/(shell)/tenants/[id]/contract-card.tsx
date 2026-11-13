"use client";

// Subscription tab > Billing contract (restiq-web#433): the restaurant's own line items,
// replacing the plan price when it has any. Saved with an audited reason.
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { ContractView, OpsApiError, saveContract } from "../../api";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { useToast } from "../../toast";
import { useOpsLoad } from "../../use-ops-load";
import { amountMinor, emptyRow, isChanged, lineTotalMinor, planRow, rowsFromView, totals, validateRows, type ContractRow } from "./contract-state";

const INPUT = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const LABEL = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:sr-only";
const GRID = "grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_8.5rem_6.5rem_2.25rem] sm:items-center";

export function ContractCard({ tenantId, plan, onSaved }: Readonly<{ tenantId: string; plan: string; onSaved: () => void }>) {
  const { loading, failed, data, retry } = useOpsLoad<ContractView>(`tenants/${tenantId}/subscription/contract`);
  return (
    <section className="rounded-lg border border-border/40 bg-card p-5" data-testid="contract-card" aria-labelledby="contract-heading">
      <h3 id="contract-heading" className="font-headline text-base font-semibold">
        Billing contract
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">This restaurant&apos;s own line items. With none, it pays the plan price.</p>
      <div className="mt-4">
        {failed ? (
          <LoadErrorPanel message="The billing contract could not be loaded." onRetry={retry} testId="contract-error" />
        ) : loading || !data ? (
          <Skeleton className="h-24 w-full" data-testid="contract-loading" />
        ) : (
          <ContractEditor tenantId={tenantId} plan={plan} initial={data} onSaved={onSaved} />
        )}
      </div>
    </section>
  );
}

function ContractEditor({ tenantId, plan, initial, onSaved }: Readonly<{ tenantId: string; plan: string; initial: ContractView; onSaved: () => void }>) {
  const toast = useToast();
  const [view, setView] = useState(initial);
  const [rows, setRows] = useState<ContractRow[]>(() => rowsFromView(initial));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const checked = validateRows(rows);
  const rowsError = "error" in checked ? checked.error : null;
  const changed = isChanged(rows, view);
  const canSave = changed && !rowsError && reason.trim() !== "" && !busy;
  const { recurringMinor, oneTimeMinor } = totals(rows);
  const period = view.billingPeriod === "annual" ? "year" : "month";
  const money = (minor: number) => formatMoney(minor, view.currency);
  const editable = rows.filter((row) => !row.billedAt);

  function update(key: string, patch: Partial<ContractRow>) {
    setSaveError(null);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function add(row: ContractRow) {
    setSaveError(null);
    // New rows go above the billed ones, matching the order the server returns.
    setRows((current) => [...current.filter((r) => !r.billedAt), row, ...current.filter((r) => r.billedAt)]);
  }

  async function save() {
    if ("error" in checked || !canSave) return;
    setBusy(true);
    setSaveError(null);
    try {
      const saved = await saveContract(tenantId, { items: checked.items, reason: reason.trim() });
      setView(saved);
      setRows(rowsFromView(saved));
      setReason("");
      toast({ kind: "success", message: "Billing contract saved." });
      onSaved();
    } catch (error) {
      // stripe_sync_failed (502): the contract is saved but Stripe wasn't updated; the
      // server's message says so. Rows stay as typed, so Save again retries the sync.
      setSaveError(error instanceof OpsApiError ? error.message : "The billing contract could not be saved.");
      if (error instanceof OpsApiError && error.code === "stripe_sync_failed") onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {view.appliesFromNextInvoice && (
        <p className="rounded-lg border border-status-info/40 bg-status-info/10 p-3 text-sm" data-testid="contract-next-invoice-note">
          Card billing is active: changes apply from the next invoice; nothing is charged now.
        </p>
      )}

      {editable.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="contract-plan-source">
          No contract — this restaurant pays the {plan} plan price (
          {view.planAmountMinor === null ? "no price set" : `${money(Number(view.planAmountMinor))} per ${period}`}).
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid gap-3 sm:gap-2" data-testid="contract-rows">
          <div aria-hidden="true" className={`${GRID} hidden font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid`}>
            <span>Description</span>
            <span>Qty</span>
            <span>Amount</span>
            <span>Charged</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {rows.map((row, index) =>
            row.billedAt ? (
              <BilledRow key={row.key} row={row} money={money} />
            ) : (
              <div key={row.key} className={`${GRID} rounded-lg border border-border/40 p-3 sm:border-0 sm:p-0`} data-testid={`contract-row-${index}`}>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={`contract-description-${index}`} className={LABEL}>
                    Description
                  </label>
                  <input
                    id={`contract-description-${index}`}
                    data-testid={`contract-description-${index}`}
                    maxLength={120}
                    value={row.description}
                    onChange={(event) => update(row.key, { description: event.target.value })}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor={`contract-quantity-${index}`} className={LABEL}>
                    Qty
                  </label>
                  <input
                    id={`contract-quantity-${index}`}
                    data-testid={`contract-quantity-${index}`}
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(event) => update(row.key, { quantity: event.target.value })}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor={`contract-amount-${index}`} className={LABEL}>
                    Amount ({view.currency})
                  </label>
                  <input
                    id={`contract-amount-${index}`}
                    data-testid={`contract-amount-${index}`}
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(event) => update(row.key, { amount: event.target.value })}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor={`contract-kind-${index}`} className={LABEL}>
                    Charged
                  </label>
                  <select
                    id={`contract-kind-${index}`}
                    data-testid={`contract-kind-${index}`}
                    value={row.kind}
                    onChange={(event) => update(row.key, { kind: event.target.value === "one_time" ? "one_time" : "recurring" })}
                    className={`${INPUT} h-10`}
                  >
                    <option value="recurring">Every period</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
                <div className="self-center text-right tabular-nums" data-testid={`contract-line-total-${index}`}>
                  {lineTotalMinor(row) === null ? "-" : money(lineTotalMinor(row) ?? 0)}
                </div>
                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove line ${index + 1}`}
                    data-testid={`contract-remove-${index}`}
                    className="text-status-critical hover:bg-status-critical/10"
                    onClick={() => {
                      setSaveError(null);
                      setRows((current) => current.filter((r) => r.key !== row.key));
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" data-testid="contract-add" onClick={() => add(emptyRow())}>
          <Plus aria-hidden="true" /> Add line
        </Button>
        <Button
          size="sm"
          variant="secondary"
          data-testid="contract-start-from-plan"
          disabled={view.planAmountMinor === null}
          onClick={() => view.planAmountMinor !== null && add(planRow(plan, view.planAmountMinor))}
        >
          Start from plan price
        </Button>
      </div>

      {editable.length > 0 && (
        <div className="text-sm" data-testid="contract-totals">
          <p className="font-semibold">
            Per {period}: <span data-testid="contract-recurring-total">{money(recurringMinor)}</span>
          </p>
          {oneTimeMinor > 0 && (
            <p className="text-muted-foreground">
              One-time on next invoice: <span data-testid="contract-one-time-total">{money(oneTimeMinor)}</span>
            </p>
          )}
        </div>
      )}

      {changed && rowsError && (
        <p role="alert" className="text-sm text-status-critical" data-testid="contract-validation-error">
          {rowsError}
        </p>
      )}

      {changed && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grow">
            <label htmlFor="contract-reason" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reason for the change
            </label>
            <input
              id="contract-reason"
              data-testid="contract-reason"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={INPUT}
            />
          </div>
          <Button data-testid="contract-save" disabled={!canSave} onClick={() => void save()}>
            {busy ? "Saving..." : "Save contract"}
          </Button>
        </div>
      )}

      {saveError && (
        <p role="alert" className="text-sm text-status-critical" data-testid="contract-save-error">
          {saveError}
        </p>
      )}
    </div>
  );
}

function BilledRow({ row, money }: Readonly<{ row: ContractRow; money: (minor: number) => string }>) {
  return (
    <div className={`${GRID} rounded-lg border border-border/40 p-3 text-sm text-muted-foreground sm:border-0 sm:px-0 sm:py-1`} data-testid={`contract-billed-${row.key}`}>
      <span className="col-span-2 sm:col-span-1">
        {row.description}
        <span className="font-label ml-2 rounded-[6px] border border-status-healthy/50 bg-status-healthy/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-status-healthy">
          Billed
        </span>
      </span>
      <span>× {row.quantity}</span>
      <span className="tabular-nums">{money(amountMinor(row.amount) ?? 0)}</span>
      <span>One-time</span>
      <span className="text-right tabular-nums">{money(lineTotalMinor(row) ?? 0)}</span>
      <span />
    </div>
  );
}
