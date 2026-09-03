"use client";

// T9 Reports Catalogue (CAP-9): a card grid grouped by category, each real
// report exporting a CSV and each pending one saying so honestly (no fake
// report data - issue #42's acceptance bar). Single GET, same
// load/error/retry shape as dashboard.tsx/staff.tsx (useAdminLoad exists
// precisely for this GET-and-render pattern).
import { ArrowRight, Landmark, Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, exportReport } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useAdminLoad } from "../use-admin-load";
import { ExportDestinationsDialog } from "./export-destinations-dialog";
import { ReportCard } from "./report-card";
import { categorySlug, categoryLabel, downloadReportExport, groupReportsByCategory, type ReportDefinition } from "./reports-state";

function LoadingShell() {
  return (
    <div className="space-y-6" data-testid="reports-loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

export function Reports() {
  const { loading, failed, data, retry } = useAdminLoad<ReportDefinition[]>("reports");

  if (loading) return <LoadingShell />;
  if (failed) return <LoadErrorPanel testId="reports-load-error" message="The reports catalogue couldn't be loaded." onRetry={retry} />;
  if (!data) return null;

  return <ReportsCatalogue reports={data} />;
}

function ReportsCatalogue({ reports }: Readonly<{ reports: ReportDefinition[] }>) {
  const toast = useToast();
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const groups = groupReportsByCategory(reports);

  async function handleExport(reportKey: string, format: string) {
    setExportingKey(reportKey);
    try {
      const result = await exportReport(reportKey, format);
      downloadReportExport(result);
      toast({ kind: "success", message: `${result.filename} downloaded.` });
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "Couldn't export that report." });
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Reports Catalogue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Analyze performance, monitor operations, and generate financial extracts.</p>
        </div>
        <Button variant="secondary" size="sm" data-testid="reports-open-destinations" onClick={() => setDestinationsOpen(true)}>
          <Landmark aria-hidden="true" /> Accounting tools
        </Button>
      </div>

      <Link
        href="/admin/reports/payments"
        data-testid="reports-payments-link"
        className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-card p-5 transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-3">
          <Receipt className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-headline font-semibold">Payments</p>
            <p className="mt-1 text-sm text-muted-foreground">Browse every finalized bill with filters, totals, and a CSV export.</p>
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      {groups.map((group) => (
        <section key={group.category} data-testid={`reports-category-${categorySlug(group.category)}`}>
          <h2 className="font-headline text-lg font-semibold">{categoryLabel(group.category)}</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-3">
            {group.reports.map((report) => (
              <ReportCard key={report.key} report={report} exporting={exportingKey === report.key} onExport={(key, format) => void handleExport(key, format)} />
            ))}
          </div>
        </section>
      ))}

      <ExportDestinationsDialog open={destinationsOpen} onClose={() => setDestinationsOpen(false)} />
    </div>
  );
}
