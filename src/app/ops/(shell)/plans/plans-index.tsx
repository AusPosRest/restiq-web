"use client";

// Plans (issue #323): the list price of each plan per country, per outlet per
// month (restiq-backend#201). New tenants are priced from here in the
// onboarding wizard. A change needs a reason and is audited.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OpsApiError, opsApi, type PlanPriceView } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";
import { COUNTRY_LABEL, CURRENCY_SYMBOL, PLAN_LABEL, formFromPrice, isDirty, validatePlanPriceForm, type PlanPriceForm } from "./plans-state";

const INPUT = "h-9 w-28 rounded-lg border border-border bg-input px-2.5 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const keyOf = (row: Pick<PlanPriceView, "country" | "plan">) => `${row.country}-${row.plan}`;

const COUNTRIES: PlanPriceView["country"][] = ["IN", "AU"];

export function PlansIndex() {
  const load = useOpsLoad<{ prices: PlanPriceView[] }>("plan-prices");
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-headline text-2xl font-semibold">Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">List price per outlet per month. New tenants are priced from here when you onboard them.</p>
      </div>
      {load.loading && <Skeleton className="h-64" data-testid="plans-loading" />}
      {load.failed && <LoadErrorPanel testId="plans-load-error" message="Plan prices couldn't be loaded." onRetry={load.retry} />}
      {load.data && <PlansTable initial={load.data.prices} />}
    </div>
  );
}

function PlansTable({ initial }: Readonly<{ initial: PlanPriceView[] }>) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [forms, setForms] = useState<Record<string, PlanPriceForm>>(() => Object.fromEntries(initial.map((row) => [keyOf(row), formFromPrice(row)])));
  const [confirming, setConfirming] = useState<PlanPriceView | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(row: PlanPriceView, patch: Partial<PlanPriceForm>) {
    setForms((current) => ({ ...current, [keyOf(row)]: { ...current[keyOf(row)], ...patch } }));
  }

  async function save(row: PlanPriceView, reason: string) {
    const checked = validatePlanPriceForm(forms[keyOf(row)]);
    if ("error" in checked) return;
    setBusy(true);
    try {
      const { price } = await opsApi<{ price: PlanPriceView }>(`plan-prices/${row.country}/${row.plan}`, { method: "PUT", body: JSON.stringify({ ...checked, reason }) });
      setRows((current) => current.map((r) => (keyOf(r) === keyOf(price) ? price : r)));
      setForms((current) => ({ ...current, [keyOf(price)]: formFromPrice(price) }));
      setConfirming(null);
      toast({ kind: "success", message: `${COUNTRY_LABEL[price.country]} ${PLAN_LABEL[price.plan]} price saved.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Couldn't save that price." });
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p data-testid="plans-empty" className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No plan prices are set up.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {COUNTRIES.map((country) => [country, rows.filter((row) => row.country === country)] as const)
          .filter(([, countryRows]) => countryRows.length > 0)
          .map(([country, countryRows]) => (
          <section
            key={country}
            data-testid={`plans-country-${country}`}
            aria-labelledby={`plans-country-${country}-heading`}
            className="rounded-lg border border-border/40 bg-card"
          >
            <div className="border-b border-border/40 px-4 py-3">
              <h2 id={`plans-country-${country}-heading`} className="font-headline text-lg font-semibold">
                {COUNTRY_LABEL[country]}
              </h2>
              <p className="text-sm text-muted-foreground">{`Prices in ${countryRows[0].currency} (${CURRENCY_SYMBOL[countryRows[0].currency]})`}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid={`plans-table-${country}`}>
                <thead>
                  <tr className="h-12 border-b border-border/40 text-left">
                    <th className="px-4 font-semibold text-muted-foreground">Plan</th>
                    <th className="px-4 font-semibold text-muted-foreground">Price / outlet / month</th>
                    <th className="px-4 font-semibold text-muted-foreground">Annual discount</th>
                    <th className="px-4" />
                  </tr>
                </thead>
                <tbody>
                  {countryRows.map((row) => {
                    const key = keyOf(row);
                    const form = forms[key];
                    const checked = validatePlanPriceForm(form);
                    const error = "error" in checked ? checked.error : null;
                    return (
                      <tr key={key} data-testid={`plan-row-${key}`} className="border-b border-border/20 last:border-b-0 align-top">
                        <td className="px-4 py-3 font-medium">{PLAN_LABEL[row.plan]}</td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{CURRENCY_SYMBOL[row.currency]}</span>
                            <span className="sr-only">{`${COUNTRY_LABEL[row.country]} ${PLAN_LABEL[row.plan]} monthly price`}</span>
                            <input
                              inputMode="decimal"
                              placeholder="On quote"
                              data-testid={`plan-price-${key}`}
                              value={form.price}
                              onChange={(event) => edit(row, { price: event.target.value })}
                              className={INPUT}
                            />
                          </label>
                          {error && (
                            <p role="alert" data-testid={`plan-error-${key}`} className="mt-1 text-xs text-status-critical">
                              {error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-1.5">
                            <span className="sr-only">{`${COUNTRY_LABEL[row.country]} ${PLAN_LABEL[row.plan]} annual discount`}</span>
                            <input
                              inputMode="numeric"
                              data-testid={`plan-discount-${key}`}
                              value={form.discount}
                              onChange={(event) => edit(row, { discount: event.target.value })}
                              className={`${INPUT} w-16`}
                            />
                            <span className="text-muted-foreground">%</span>
                          </label>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" data-testid={`plan-save-${key}`} disabled={!isDirty(form, row) || error !== null || busy} onClick={() => setConfirming(row)}>
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <ConfirmReasonDialog
        open={confirming !== null}
        title="Change this price?"
        description={confirming ? `New ${COUNTRY_LABEL[confirming.country]} tenants on ${PLAN_LABEL[confirming.plan]} will be priced from it. Existing tenants keep what they agreed.` : ""}
        verb="Save price"
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={(reason) => confirming && void save(confirming, reason)}
      />
    </>
  );
}
