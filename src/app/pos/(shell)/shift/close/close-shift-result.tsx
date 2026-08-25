// P12 step 2: the reveal. Immutable (AD-14: a closed shift's over/short
// record is insert-only once written) - no edit or recount action, only a
// way back to the till.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ClosedShift } from "../../../api";
import { formatMinor } from "../shift-state";

export function CloseShiftResult({ result, currency }: Readonly<{ result: ClosedShift; currency: string }>) {
  const isOverOrExact = result.overShortMinor >= 0;

  return (
    <div data-testid="close-shift-result" className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="font-headline text-2xl font-semibold">Shift closed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Closed at {new Date(result.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <dl className="w-full space-y-3 rounded-lg border border-border/40 bg-card p-5 text-left">
        <div className="flex items-center justify-between">
          <dt className="text-sm text-muted-foreground">Counted</dt>
          <dd className="tabular-nums font-semibold" data-testid="result-counted">
            {formatMinor(result.countedMinor, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm text-muted-foreground">Expected</dt>
          <dd className="tabular-nums font-semibold" data-testid="result-expected">
            {formatMinor(result.expectedMinor, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <dt className="text-sm font-medium">{isOverOrExact ? "Over" : "Short"}</dt>
          <dd
            data-testid="result-over-short"
            className={`tabular-nums text-lg font-bold ${isOverOrExact ? "text-status-available" : "text-status-alert"}`}
          >
            {isOverOrExact ? "+" : "-"}
            {formatMinor(Math.abs(result.overShortMinor), currency)}
          </dd>
        </div>
      </dl>

      <Link href="/pos/shift" data-testid="close-shift-done">
        <Button size="lg">Done</Button>
      </Link>
    </div>
  );
}
