// P11's cash movement log: every paid-out/bank-drop this shift, newest first,
// each carrying its reason (SPEC CAP-10). Read-only - a movement is never
// edited once logged. No per-movement staff name: the real backend returns
// createdByStaffId, not a display name, and there's no staff-directory
// lookup in this story's scope to resolve one.
import type { CashMovementView } from "../../api";
import { formatMinor } from "./shift-state";

const TYPE_LABEL: Record<CashMovementView["type"], string> = { paid_out: "Paid out", bank_drop: "Bank drop" };

export function CashMovementLog({ movements, currency }: Readonly<{ movements: CashMovementView[]; currency: string }>) {
  if (movements.length === 0) {
    return (
      <p data-testid="movement-log-empty" className="rounded-lg border border-dashed border-border/60 bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
        No cash movements logged yet this shift.
      </p>
    );
  }

  return (
    <ul data-testid="movement-log" className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/40 bg-card">
      {[...movements].reverse().map((movement) => (
        <li key={movement.id} data-testid={`movement-row-${movement.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{TYPE_LABEL[movement.type]}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{movement.reason}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular-nums font-semibold">{formatMinor(movement.amountMinor, currency)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
