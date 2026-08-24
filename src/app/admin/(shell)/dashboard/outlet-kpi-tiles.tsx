// Per-outlet sales/margin/labour/waste KPI tiles (SPEC CAP-8). Each tile
// renders the honest no-data state until its metric carries status:
// "available" - see dashboard-state.ts's file header for why these are
// discriminated unions rather than bare numbers.
import { Percent, Receipt, Trash2, Users } from "lucide-react";
import { formatPriceMinor } from "../menu/menu-state";
import { formatPercent, type OutletKpis } from "./dashboard-state";
import { KpiStatCard, NoFinancialData } from "./kpi-stat-card";

export function OutletKpiTiles({ outlet }: Readonly<{ outlet: OutletKpis }>) {
  const prefix = `outlet-kpi-${outlet.outletId}`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid={`${prefix}-tiles`}>
      <KpiStatCard testId={`${prefix}-sales`} label="Sales" icon={Receipt}>
        {outlet.sales.status === "available" ? (
          <p data-testid={`${prefix}-sales-value`} className="text-3xl font-semibold tabular-nums">
            {formatPriceMinor(outlet.sales.totalMinor, outlet.sales.currency)}
          </p>
        ) : (
          <NoFinancialData testId={`${prefix}-sales-empty`} />
        )}
      </KpiStatCard>

      <KpiStatCard testId={`${prefix}-margin`} label="Margin" icon={Percent}>
        {outlet.margin.status === "available" ? (
          <p data-testid={`${prefix}-margin-value`} className="text-3xl font-semibold tabular-nums">
            {formatPercent(outlet.margin.percent)}
          </p>
        ) : (
          <NoFinancialData testId={`${prefix}-margin-empty`} />
        )}
      </KpiStatCard>

      <KpiStatCard testId={`${prefix}-labour`} label="Labour" icon={Users}>
        {outlet.labour.status === "available" ? (
          <div data-testid={`${prefix}-labour-value`}>
            <p className="text-3xl font-semibold tabular-nums">{formatPriceMinor(outlet.labour.costMinor, outlet.labour.currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatPercent(outlet.labour.percentOfSales)} of sales</p>
          </div>
        ) : (
          <NoFinancialData testId={`${prefix}-labour-empty`} />
        )}
      </KpiStatCard>

      <KpiStatCard testId={`${prefix}-waste`} label="Waste" icon={Trash2}>
        {outlet.waste.status === "available" ? (
          <p data-testid={`${prefix}-waste-value`} className="text-3xl font-semibold tabular-nums">
            {formatPriceMinor(outlet.waste.costMinor, outlet.waste.currency)}
          </p>
        ) : (
          <NoFinancialData testId={`${prefix}-waste-empty`} />
        )}
      </KpiStatCard>
    </div>
  );
}
