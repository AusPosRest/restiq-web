// Per-outlet takings today (SPEC CAP-8). Only Sales has a data source
// (restiq-backend#189: today's tenders on the outlet's own day); margin,
// labour and waste have nothing recording them yet, so their tiles are not
// shown rather than four identical "no data" boxes.
import { Receipt } from "lucide-react";
import { formatPriceMinor } from "../menu/menu-state";
import type { OutletKpis } from "./dashboard-state";
import { KpiStatCard, NoFinancialData } from "./kpi-stat-card";

export function OutletKpiTiles({ outlet }: Readonly<{ outlet: OutletKpis }>) {
  const prefix = `outlet-kpi-${outlet.outletId}`;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid={`${prefix}-tiles`}>
      <KpiStatCard testId={`${prefix}-sales`} label="Sales today" icon={Receipt}>
        {outlet.sales.hasData ? (
          <p data-testid={`${prefix}-sales-value`} className="text-3xl font-semibold tabular-nums">
            {formatPriceMinor(outlet.sales.amountMinor, outlet.sales.currency)}
          </p>
        ) : (
          <NoFinancialData testId={`${prefix}-sales-empty`} />
        )}
      </KpiStatCard>
    </div>
  );
}
