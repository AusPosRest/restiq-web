"use client";

// Settings ▸ Card readers (restiq-web#429): the owner's Stripe smart readers (status only; the
// provider pairs them), and ordering more. An order is charged straight away to the card the
// subscription is billed to, then the provider orders, ships and delivers it - each step shows here.
import { CheckCircle2, CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  currencyForCountry,
  deviceTypeLabel,
  ORDER_STATUS_LABEL,
  shippingSummary,
  type CardReaderView,
  type ReaderOrderView,
  type ReaderPriceView,
  type ShippingAddress,
} from "@/lib/card-readers";
import { formatDate } from "@/lib/datetime";
import { formatPrice } from "@/lib/money";
import { adminApi, AdminApiError } from "../../api";
import type { OutletView } from "../menu/menu-state";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { useAdminLoad } from "../use-admin-load";
import { emptyOrderForm, MAX_QUANTITY, orderTotalMinor, progressIndex, PROGRESS_STEPS, validateOrderForm, type OrderForm } from "./card-readers-state";

interface CardReadersData {
  readers: CardReaderView[];
  prices: ReaderPriceView[];
  cardOnFile: boolean;
  orders: ReaderOrderView[];
}

const FIELD = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const LABEL = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const CARD = "rounded-lg border border-border/40 bg-card p-6";
const DOT: Record<CardReaderView["status"], string> = { online: "bg-status-active", offline: "bg-status-error", unknown: "bg-muted-foreground" };

const SHIPPING_FIELDS: Array<{ key: keyof ShippingAddress; label: string; autoComplete: string; wide?: boolean; optional?: boolean }> = [
  { key: "name", label: "Recipient name", autoComplete: "name", wide: true },
  { key: "line1", label: "Street address", autoComplete: "address-line1", wide: true },
  { key: "line2", label: "Unit, level (optional)", autoComplete: "address-line2", wide: true, optional: true },
  { key: "city", label: "City / suburb", autoComplete: "address-level2" },
  { key: "state", label: "State", autoComplete: "address-level1" },
  { key: "postcode", label: "Postcode", autoComplete: "postal-code" },
  { key: "phone", label: "Phone", autoComplete: "tel" },
];

export function CardReadersPanel() {
  const { loading, failed, data, retry } = useAdminLoad<CardReadersData>("card-readers");
  const outlets = useOutlets();

  if (loading || outlets.loading) {
    return (
      <div className="max-w-3xl space-y-6" data-testid="card-readers-loading">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (failed || !data) return <LoadErrorPanel testId="card-readers-load-error" message="Your card readers couldn't be loaded." onRetry={retry} />;
  return <CardReadersBody data={data} outlets={outlets.outlets} selectedOutletId={outlets.selectedOutletId} />;
}

function CardReadersBody({ data, outlets, selectedOutletId }: Readonly<{ data: CardReadersData; outlets: OutletView[]; selectedOutletId: string | null }>) {
  // Orders placed here are added locally - no reload, so a failed payment keeps the form as typed.
  const [orders, setOrders] = useState(data.orders);
  return (
    <div className="max-w-3xl space-y-6" data-testid="card-readers-panel">
      <ReadersList readers={data.readers} />
      <OrderReader prices={data.prices} cardOnFile={data.cardOnFile} outlets={outlets} selectedOutletId={selectedOutletId} onOrdered={(order) => setOrders((current) => [order, ...current])} />
      <OrdersList orders={orders} />
    </div>
  );
}

function ReadersList({ readers }: Readonly<{ readers: CardReaderView[] }>) {
  return (
    <section className={CARD} aria-labelledby="card-readers-heading" data-testid="card-readers-list">
      <h2 id="card-readers-heading" className="font-headline text-lg font-semibold">
        Your card readers
      </h2>
      {readers.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="card-readers-empty">
          No readers yet. Order one below — your provider pairs it with your POS when it arrives.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/40">
          {readers.map((reader) => (
            <li key={reader.id} className="flex items-center justify-between gap-4 py-3" data-testid={`card-reader-${reader.id}`}>
              <div>
                <p className="text-sm font-medium">
                  {reader.label}
                  {reader.simulated && <span className="ml-2 text-xs font-normal text-muted-foreground">(test reader)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {deviceTypeLabel(reader.deviceType)} · {reader.outletName}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm" data-testid={`card-reader-status-${reader.id}`}>
                <span aria-hidden="true" className={`size-2 rounded-full ${DOT[reader.status]}`} />
                {reader.status === "online" ? "Online" : reader.status === "offline" ? "Offline" : "Unknown"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OrderReader({
  prices,
  cardOnFile,
  outlets,
  selectedOutletId,
  onOrdered,
}: Readonly<{ prices: ReaderPriceView[]; cardOnFile: boolean; outlets: OutletView[]; selectedOutletId: string | null; onOrdered: (order: ReaderOrderView) => void }>) {
  const startOutlet = outlets.find((o) => o.id === selectedOutletId) ?? outlets[0];
  const [form, setForm] = useState<OrderForm>(() => ({ ...emptyOrderForm(startOutlet?.id ?? "", startOutlet?.address ?? ""), model: prices.length === 1 ? prices[0].model : "" }));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReaderOrderView | null>(null);

  const currency = currencyForCountry(prices[0]?.country ?? "AU");
  const total = orderTotalMinor(prices, form.model, form.quantity);
  const checked = validateOrderForm(form, prices);
  const formError = "error" in checked ? checked.error : null;
  const canOrder = cardOnFile && prices.length > 0;

  function update(patch: Partial<OrderForm>) {
    setError(null);
    setResult(null);
    setForm((f) => ({ ...f, ...patch }));
  }

  async function submit() {
    setTouched(true);
    if ("error" in checked) return;
    setBusy(true);
    setError(null);
    try {
      const { order } = await adminApi<{ order: ReaderOrderView }>("reader-orders", { method: "POST", body: JSON.stringify(checked) });
      setResult(order);
      onOrdered(order);
      if (order.status !== "payment_failed") {
        setTouched(false);
        setForm((f) => ({ ...f, quantity: 1 }));
      }
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "The order couldn't be placed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD} aria-labelledby="order-reader-heading" data-testid="order-reader">
      <h2 id="order-reader-heading" className="font-headline text-lg font-semibold">
        Order a reader
      </h2>
      {!cardOnFile ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-4 text-sm" data-testid="order-reader-no-card">
          <CreditCard className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden="true" />
          Set up card billing first — ask your provider.
        </p>
      ) : prices.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="order-reader-none-for-sale">
          Readers aren&apos;t on sale in your country yet.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Charged now to the card your subscription is billed to.</p>
      )}

      <form
        className="mt-5 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canOrder) void submit();
        }}
      >
        <fieldset disabled={!canOrder || busy} className="space-y-5 disabled:opacity-60">
          {prices.length > 0 && (
            <div role="radiogroup" aria-label="Reader model" className="grid gap-3 sm:grid-cols-2">
              {prices.map((price) => {
                const selected = form.model === price.model;
                return (
                  <button
                    key={price.model}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`order-reader-model-${price.model}`}
                    onClick={() => update({ model: price.model })}
                    className={`rounded-lg border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{price.displayName}</span>
                    <span className="mt-1 block text-lg font-semibold tabular-nums">{price.priceMinor === null ? "-" : formatPrice(Number(price.priceMinor), currency)}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="order-reader-quantity" className={LABEL}>
                Quantity
              </label>
              <select id="order-reader-quantity" data-testid="order-reader-quantity" value={form.quantity} onChange={(event) => update({ quantity: Number(event.target.value) })} className={FIELD}>
                {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="order-reader-outlet" className={LABEL}>
                For outlet
              </label>
              <select id="order-reader-outlet" data-testid="order-reader-outlet" value={form.outletId} onChange={(event) => update({ outletId: event.target.value })} className={FIELD}>
                <option value="">Select an outlet...</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="font-headline text-base font-semibold">Ship to</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {SHIPPING_FIELDS.map(({ key, label, autoComplete, wide }) => (
                <div key={key} className={wide ? "sm:col-span-2" : undefined}>
                  <label htmlFor={`order-reader-${key}`} className={LABEL}>
                    {label}
                  </label>
                  <input
                    id={`order-reader-${key}`}
                    data-testid={`order-reader-${key}`}
                    autoComplete={autoComplete}
                    inputMode={key === "postcode" ? "numeric" : key === "phone" ? "tel" : undefined}
                    maxLength={120}
                    value={form.shipping[key]}
                    onChange={(event) => update({ shipping: { ...form.shipping, [key]: event.target.value } })}
                    className={FIELD}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </fieldset>

        {(error || (touched && formError)) && (
          <p role="alert" className="text-sm text-status-error" data-testid="order-reader-error">
            {error ?? formError}
          </p>
        )}

        {result && <OrderResult order={result} />}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-5">
          <p className="text-sm text-muted-foreground" data-testid="order-reader-total">
            Total <span className="ml-1 text-lg font-semibold tabular-nums text-foreground">{total === null ? "-" : formatPrice(total, currency)}</span>
          </p>
          <Button type="submit" data-testid="order-reader-submit" disabled={!canOrder || busy || total === null}>
            {busy ? "Paying..." : total === null ? "Choose a reader" : `Pay ${formatPrice(total, currency)} and order`}
          </Button>
        </div>
      </form>
    </section>
  );
}

function OrderResult({ order }: Readonly<{ order: ReaderOrderView }>) {
  if (order.status === "payment_failed") {
    return (
      <div role="alert" className="rounded-lg border border-status-error/40 bg-status-error/10 p-4 text-sm" data-testid="order-reader-failed">
        <p className="font-semibold">The payment didn&apos;t go through.</p>
        <p className="mt-1 text-muted-foreground">{order.failureMessage ?? "Your card was declined."} Nothing was ordered — check the card with your provider, then try again.</p>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-status-active/40 bg-status-active/10 p-4 text-sm" data-testid="order-reader-paid">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-active" aria-hidden="true" />
      <p>
        Paid {formatPrice(Number(order.totalMinor), order.currency)}. Your provider will order {order.quantity === 1 ? "the reader" : "the readers"} and add tracking below once {order.quantity === 1 ? "it ships" : "they ship"}.
      </p>
    </div>
  );
}

function OrdersList({ orders }: Readonly<{ orders: ReaderOrderView[] }>) {
  if (orders.length === 0) return null;
  return (
    <section className={CARD} aria-labelledby="reader-orders-heading" data-testid="reader-orders">
      <h2 id="reader-orders-heading" className="font-headline text-lg font-semibold">
        Your orders
      </h2>
      <ul className="mt-4 divide-y divide-border/40">
        {orders.map((order) => {
          const reached = progressIndex(order.status);
          return (
            <li key={order.id} className="py-4" data-testid={`reader-order-${order.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {order.displayName} × {order.quantity} · {formatPrice(Number(order.totalMinor), order.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(order.createdAt)} · to {shippingSummary(order.shipping)}
                </p>
              </div>
              {reached === null ? (
                <p className={`mt-2 text-sm font-semibold ${order.status === "payment_failed" ? "text-status-error" : "text-muted-foreground"}`} data-testid={`reader-order-status-${order.id}`}>
                  {ORDER_STATUS_LABEL[order.status]}
                  {order.failureMessage && <span className="ml-1 font-normal text-muted-foreground">— {order.failureMessage}</span>}
                </p>
              ) : (
                <ol className="mt-3 grid grid-cols-4 gap-1" aria-label={`Order progress: ${ORDER_STATUS_LABEL[order.status]}`} data-testid={`reader-order-status-${order.id}`}>
                  {PROGRESS_STEPS.map((step, i) => (
                    <li key={step} aria-current={i === reached ? "step" : undefined}>
                      <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-primary" : "bg-accent"}`} />
                      <span className={`mt-1 block text-xs ${i <= reached ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{ORDER_STATUS_LABEL[step]}</span>
                    </li>
                  ))}
                </ol>
              )}
              {order.trackingRef && (
                <p className="mt-2 text-xs text-muted-foreground" data-testid={`reader-order-tracking-${order.id}`}>
                  Tracking: {order.trackingRef}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
