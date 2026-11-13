"use client";

// Reader orders (restiq-web#429): card readers owners have paid for, across every restaurant.
// Opens on the orders waiting on ops (paid); the filter lives in the URL so it survives a reload.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ORDER_FILTERS, ordersPath, parseOrderFilter } from "./reader-orders-state";
import { ReaderOrdersTable } from "./reader-orders-table";

export function ReaderOrdersIndex() {
  const router = useRouter();
  const pathname = usePathname();
  const filter = parseOrderFilter(useSearchParams().get("status"));

  return (
    <section className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-headline text-2xl font-semibold">Reader orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Card readers owners have paid for. Order them from Stripe, then move each one along here — the owner sees every step.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {ORDER_FILTERS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            data-testid={`reader-orders-filter-${value || "all"}`}
            aria-pressed={filter === value}
            onClick={() => router.replace(value === "paid" ? pathname : `${pathname}?status=${value || "all"}`)}
            className={`rounded-[6px] border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === value ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ReaderOrdersTable path={ordersPath(filter)} showTenant emptyText={filter === "paid" ? "Nothing waiting — every paid order has been placed." : "No orders here."} />
    </section>
  );
}
