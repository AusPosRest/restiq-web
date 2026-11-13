// Per-outlet day at a glance (SPEC CAP-8, PE-33, CU-7). Sales today is net of
// refunds - the same figure as Reports > Payments' Net sales for today - to
// the paisa. Margin, labour and waste have nothing recording them yet, so
// they are not shown rather than as identical "no data" boxes.
import { ClipboardList, Receipt, ReceiptText, Undo2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { tenderMethodLabel } from "@/lib/tender-labels";
import type { OutletKpis } from "./dashboard-state";
import { KpiStatCard, NoFinancialData } from "./kpi-stat-card";

const PAYMENTS_REPORT = "/admin/reports/payments";

export function OutletKpiTiles({ outlet }: Readonly<{ outlet: OutletKpis }>) {
  const prefix = `outlet-kpi-${outlet.outletId}`;
  const { today } = outlet;
  const currency = outlet.sales.currency;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" data-testid={`${prefix}-tiles`}>
      <KpiStatCard testId={`${prefix}-sales`} label="Sales today" icon={Receipt} href={PAYMENTS_REPORT}>
        {outlet.sales.hasData ? (
          <>
            <p data-testid={`${prefix}-sales-value`} className="text-3xl font-semibold tabular-nums">
              {formatMoney(outlet.sales.amountMinor, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">After refunds</p>
          </>
        ) : (
          <NoFinancialData testId={`${prefix}-sales-empty`} />
        )}
      </KpiStatCard>
      <KpiStatCard testId={`${prefix}-bills`} label="Bills" icon={ReceiptText} href={PAYMENTS_REPORT}>
        <p data-testid={`${prefix}-bills-value`} className="text-3xl font-semibold tabular-nums">
          {today.billCount}
        </p>
        {today.billCount > 0 && (
          <p data-testid={`${prefix}-average-bill`} className="mt-1 text-xs text-muted-foreground">
            Average {formatMoney(today.averageBillMinor, currency)}
          </p>
        )}
      </KpiStatCard>
      <KpiStatCard testId={`${prefix}-refunds`} label="Refunds" icon={Undo2} href={PAYMENTS_REPORT}>
        <p data-testid={`${prefix}-refunds-value`} className="text-3xl font-semibold tabular-nums">
          {formatMoney(today.refundedMinor, currency)}
        </p>
      </KpiStatCard>
      <KpiStatCard testId={`${prefix}-open-orders`} label="Open orders" icon={ClipboardList}>
        <p data-testid={`${prefix}-open-orders-value`} className="text-3xl font-semibold tabular-nums">
          {today.openOrderCount}
        </p>
      </KpiStatCard>
      <KpiStatCard testId={`${prefix}-by-method`} label="Payments by method" icon={Wallet} href={PAYMENTS_REPORT}>
        {today.byMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet today.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {today.byMethod.map((row) => (
              <li key={row.method} data-testid={`${prefix}-by-method-${row.method}`} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{tenderMethodLabel(row.method)}</span>
                <span className="tabular-nums">{formatMoney(row.amountMinor, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </KpiStatCard>
    </div>
  );
}
