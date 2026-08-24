// A single report tile (DESIGN.md "Report card grid"). Real reports
// (exportFormats non-empty) get a working Export CSV action; pending ones
// show the backend's honest message instead of a fake preview - `message`
// doubles as the card's body copy for both states (see reports-state.ts's
// file header).
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportDefinition } from "./reports-state";

export function ReportCard({
  report,
  exporting,
  onExport,
}: Readonly<{
  report: ReportDefinition;
  exporting: boolean;
  onExport: (reportKey: string, format: string) => void;
}>) {
  const testId = `report-card-${report.key}`;
  const format = report.exportFormats[0];

  return (
    <div data-testid={testId} className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card p-5">
      <div>
        <p className="font-headline font-semibold">{report.name}</p>
        <p data-testid={`${testId}-message`} className="mt-1 text-sm text-muted-foreground">
          {report.message}
        </p>
      </div>

      {format ? (
        <Button
          size="sm"
          variant="secondary"
          data-testid={`${testId}-export`}
          disabled={exporting}
          onClick={() => onExport(report.key, format)}
        >
          {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          {exporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
        </Button>
      ) : (
        <p data-testid={`${testId}-pending`} className="text-xs font-medium uppercase tracking-wide text-status-pending">
          Pending
        </p>
      )}
    </div>
  );
}
