// Per-outlet sales/margin/labourCost/waste KPI tiles (SPEC CAP-8). Each tile
// renders the honest no-data state until its metric's hasData is true - see
// dashboard-state.ts's file header for the real wire shape (margin and
// labourCost are currency amounts, not percentages).
import { Receipt, Trash2, TrendingUp, Users } from "lucide-react";
import { formatPriceMinor } from "../menu/menu-state";
import type { FinancialMetric, OutletKpis } from "./dashboard-state";
import { KpiStatCard, NoFinancialData } from "./kpi-stat-card";

function MetricValue({ testId, metric }: Readonly<{ testId: string; metric: FinancialMetric }>) {
  return metric.hasData ? (
    <p data-testid={`${testId}-value`} className="text-3xl font-semibold tabular-nums">
      {formatPriceMinor(metric.amountMinor, metric.currency)}
    </p>
  ) : (
    <NoFinancialData testId={`${testId}-empty`} />
  );
}

export function OutletKpiTiles({ outlet }: Readonly<{ outlet: OutletKpis }>) {
  const prefix = `outlet-kpi-${outlet.outletId}`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid={`${prefix}-tiles`}>
      <KpiStatCard testId={`${prefix}-sales`} label="Sales" icon={Receipt}>
        <MetricValue testId={`${prefix}-sales`} metric={outlet.sales} />
      </KpiStatCard>

      <KpiStatCard testId={`${prefix}-margin`} label="Margin" icon={TrendingUp}>
        <MetricValue testId={`${prefix}-margin`} metric={outlet.margin} />
      </KpiStatCard>

      <KpiStatCard testId={`${prefix}-labour`} label="Labour" icon={Users}>
        <MetricValue testId={`${prefix}-labour`} metric={outlet.labourCost} />
      </KpiStatCard>

      <KpiStatCard testId={`${prefix}-waste`} label="Waste" icon={Trash2}>
        <MetricValue testId={`${prefix}-waste`} metric={outlet.waste} />
      </KpiStatCard>
    </div>
  );
}
