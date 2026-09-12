"use client";

// A browser tab standing in for a receipt printer (issue #172 web /
// restiq-backend#127). Polls the outlet's unprinted jobs every 5s (the KDS
// boards' poll shape, kds/(shell)/expo/use-expo-board.ts), acks each one
// via POST print-jobs/:id/printed, and "prints" it as a thermal receipt that
// feeds out of the slot (issue #208) - newest under the printer, the last
// few still hanging below it. Stale-on-failure like the KDS:
// a failed poll never blanks the roll, it just flips the status light.
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { listPendingPrintJobs, markPrintJobPrinted, type PrintJobView } from "../api";
import { ThermalReceipt } from "./thermal-receipt";

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
          // Print first, ack second: acking before the roll update lost the
          // job whenever the effect was torn down mid-ack (React dev
          // double-mount, a quick unmount) - the spool marked it printed
          // but nothing ever showed it. An un-acked job is simply listed
          // again next poll and de-duplicated by id.
          setRoll((current) => [job, ...current.filter((entry) => entry.id !== job.id)].slice(0, ROLL_LENGTH));
          await markPrintJobPrinted(job.id);
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

      <div className="flex flex-col items-center">
        {/* The paper slot: receipts emerge from under this bar. */}
        <div aria-hidden="true" className="h-3 w-[318px] rounded-sm bg-neutral-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]" />
        {roll.length === 0 ? (
          <p data-testid="printer-empty" className="py-16 text-center text-sm text-muted-foreground">
            Waiting for print jobs…
          </p>
        ) : (
          <ol data-testid="printer-roll" className="flex flex-col items-center gap-6 pt-1">
            {roll.map((job) => (
              <li key={job.id} data-testid={`printer-receipt-${job.id}`} className="animate-paper-feed motion-reduce:animate-none">
                <ThermalReceipt invoice={job.payload} printedAt={job.createdAt} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
