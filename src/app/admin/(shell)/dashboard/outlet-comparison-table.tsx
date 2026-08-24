// Cross-outlet comparison (SPEC CAP-8: "cross-outlet comparison when they
// have more than one"). Renders whenever there's more than one outlet, even
// while every metric is still the no-data state - the table structure itself
// is real, only the figures are pending POS Core Loop.
import { formatPriceMinor } from "../menu/menu-state";
import { formatPercent, type OutletKpis } from "./dashboard-state";

const NO_DATA = "No data yet";

export function OutletComparisonTable({ outlets }: Readonly<{ outlets: readonly OutletKpis[] }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card">
      <table className="w-full text-sm" data-testid="dashboard-comparison-table">
        <thead>
          <tr className="h-12 border-b border-border/40">
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outlet</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sales</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margin</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Labour</th>
            <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waste</th>
          </tr>
        </thead>
        <tbody>
          {outlets.map((outlet) => (
            <tr key={outlet.outletId} data-testid={`dashboard-comparison-row-${outlet.outletId}`} className="h-12 border-b border-border/20 last:border-b-0">
              <td className="px-4 font-medium">{outlet.outletName}</td>
              <td className="px-4 tabular-nums text-muted-foreground" data-testid={`dashboard-comparison-${outlet.outletId}-sales`}>
                {outlet.sales.status === "available" ? formatPriceMinor(outlet.sales.totalMinor, outlet.sales.currency) : NO_DATA}
              </td>
              <td className="px-4 tabular-nums text-muted-foreground" data-testid={`dashboard-comparison-${outlet.outletId}-margin`}>
                {outlet.margin.status === "available" ? formatPercent(outlet.margin.percent) : NO_DATA}
              </td>
              <td className="px-4 tabular-nums text-muted-foreground" data-testid={`dashboard-comparison-${outlet.outletId}-labour`}>
                {outlet.labour.status === "available" ? formatPriceMinor(outlet.labour.costMinor, outlet.labour.currency) : NO_DATA}
              </td>
              <td className="px-4 tabular-nums text-muted-foreground" data-testid={`dashboard-comparison-${outlet.outletId}-waste`}>
                {outlet.waste.status === "available" ? formatPriceMinor(outlet.waste.costMinor, outlet.waste.currency) : NO_DATA}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
