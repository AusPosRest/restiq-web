"use client";

// A browser tab standing in for a receipt printer (issue #172 web /
// restiq-backend#127). Polls the outlet's unprinted jobs every 5s (the KDS
// boards' poll shape, kds/(shell)/expo/use-expo-board.ts), acks each one
// via POST print-jobs/:id/printed, and "prints" it onto a paper roll that
// keeps the most recent receipts on screen. Stale-on-failure like the KDS:
// a failed poll never blanks the roll, it just flips the status light.
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { listPendingPrintJobs, markPrintJobPrinted, type PrintJobView } from "../api";
import { InvoiceReceipt } from "../bills/[billId]/invoice/bill-invoice-view";

const POLL_MS = 5_000;
// ponytail: fixed roll length; make it scrollable history if anyone asks.
const ROLL_LENGTH = 10;

export function PrinterScreen({ outletId, outletName }: Readonly<{ outletId: string; outletName: string }>) {
  const [roll, setRoll] = useState<PrintJobView[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const pending = await listPendingPrintJobs(outletId);
        if (cancelled) return;
        setFailed(false);
        for (const job of pending) {
          const printed = await markPrintJobPrinted(job.id);
          if (cancelled) return;
          setRoll((current) => [...current.filter((entry) => entry.id !== printed.id), printed].slice(-ROLL_LENGTH));
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [outletId]);

  return (
    <div data-testid="printer-screen" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Printer className="size-5 text-primary" aria-hidden="true" />
          <div>
            <p className="font-headline text-sm font-semibold">Receipt printer</p>
            <p className="text-xs text-muted-foreground">{outletName || "No outlet"} · simulated</p>
          </div>
        </div>
        <span
          data-testid="printer-status"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${failed ? "bg-status-error/15 text-status-error" : "bg-accent text-status-available"}`}
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          {failed ? "Reconnecting" : "Ready"}
        </span>
      </header>

      {roll.length === 0 ? (
        <p data-testid="printer-empty" className="py-16 text-center text-sm text-muted-foreground">
          Waiting for print jobs…
        </p>
      ) : (
        <ol data-testid="printer-roll" className="flex flex-col gap-4">
          {roll.map((job) => (
            <li
              key={job.id}
              data-testid={`printer-receipt-${job.id}`}
              className="flex flex-col gap-4 rounded-sm border border-border/60 bg-popover p-5 text-sm shadow-lg [mask-image:linear-gradient(black_calc(100%-6px),transparent)]"
            >
              <InvoiceReceipt invoice={job.payload} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
