// The load-bearing component of the whole KDS surface (DESIGN.md: "the
// TicketCard is the load-bearing component... one component, whole
// contract"). Established here (issue #66/CAP-2); K2's expo consolidation
// and K3's bumped/recall view are expected to reuse this component's line
// rendering, not re-implement it.
//
// Color never stands alone (EXPERIENCE.md Accessibility Floor): the ageing
// state is also carried by the elapsed-time figure itself (it's the number
// that's growing), and RECALLED/ADD-ON/VOID are always rendered as words.
import { ageingLevel, formatElapsed, groupLinesByBatch, orderTypeLabel, ticketDisplayNumber, type AgeingLevel } from "./station-queue-state";
import type { TicketLineView, TicketView } from "../../api";

const FRAME_CLASSES: Record<AgeingLevel, string> = {
  new: "border-ticket-new bg-ticket-new/10",
  ageing: "border-ticket-ageing bg-ticket-ageing/10",
  urgent: "border-ticket-urgent bg-ticket-urgent/10",
};

function TicketLineRow({ line }: Readonly<{ line: TicketLineView }>) {
  return (
    <li data-testid={`kds-line-${line.id}`} className={line.voided ? "text-ticket-urgent" : "text-foreground"}>
      <div className={`flex items-baseline gap-2 text-base ${line.voided ? "line-through decoration-2" : ""}`}>
        <span className="font-headline font-bold tabular-nums">{line.quantity}</span>
        <span className="flex-1">
          {line.itemName}
          {line.variantName ? ` (${line.variantName})` : ""}
        </span>
        {line.seatNumber != null && (
          <span data-testid={`kds-line-${line.id}-seat`} className="rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
            S{line.seatNumber}
          </span>
        )}
        {line.voided && (
          <span data-testid={`kds-line-${line.id}-void`} className="text-xs font-bold tracking-wide">
            VOID
          </span>
        )}
      </div>
      {line.modifiers.length > 0 && (
        <ul className="mt-0.5 ml-6 space-y-0.5 text-sm text-muted-foreground">
          {line.modifiers.map((modifier) => (
            <li key={modifier.id}>- {modifier.name}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function TicketCard({
  ticket,
  ageingThresholdMinutes,
  nowMs,
  pending,
  errorMessage,
  onBump,
  onRecall,
  onRefire,
}: Readonly<{
  ticket: TicketView;
  ageingThresholdMinutes: number;
  nowMs: number;
  pending: boolean;
  errorMessage: string | null;
  onBump: () => void;
  onRecall: () => void;
  onRefire: () => void;
}>) {
  const level = ageingLevel(ticket.firedAt, ageingThresholdMinutes, nowMs);
  const batches = groupLinesByBatch(ticket.lines);

  return (
    <article
      data-testid={`kds-ticket-${ticket.id}`}
      data-ageing={level}
      className={`flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border-2 bg-card ${ticket.status === "bumped" ? "border-ticket-bumped bg-ticket-bumped/10" : FRAME_CLASSES[level]}`}
    >
      {ticket.recalled && (
        <div data-testid={`kds-ticket-${ticket.id}-recalled-banner`} className="bg-ticket-recalled px-3 py-1 text-center text-xs font-bold tracking-wide text-white">
          RECALLED
        </div>
      )}

      <header className="flex items-start justify-between gap-2 px-3 pt-3">
        <div>
          <p data-testid={`kds-ticket-${ticket.id}-number`} className="font-headline text-xl font-bold text-foreground">
            {ticketDisplayNumber(ticket)}
          </p>
          <p className="text-xs text-muted-foreground">
            {orderTypeLabel(ticket)}
            {ticket.tableLabel ? ` - ${ticket.tableLabel}` : ""}
          </p>
        </div>
        <p data-testid={`kds-ticket-${ticket.id}-elapsed`} className="font-headline text-3xl font-bold tabular-nums text-foreground">
          {formatElapsed(ticket.firedAt, nowMs)}
        </p>
      </header>

      <div className="flex-1 space-y-3 px-3 py-3">
        {batches.map(({ batch, lines }) => (
          <div key={batch}>
            {batch > 0 && (
              <p data-testid={`kds-ticket-${ticket.id}-addon-${batch}`} className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wide text-ticket-new">
                <span className="h-px flex-1 bg-ticket-new/40" aria-hidden="true" />
                ADD-ON
                <span className="h-px flex-1 bg-ticket-new/40" aria-hidden="true" />
              </p>
            )}
            <ul className="space-y-2">
              {lines.map((line) => (
                <TicketLineRow key={line.id} line={line} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {errorMessage && (
        <p role="alert" data-testid={`kds-ticket-${ticket.id}-error`} className="px-3 pb-1 text-xs font-medium text-ticket-urgent">
          {errorMessage} - retrying
        </p>
      )}

      <div className="flex gap-2 p-3 pt-0">
        {ticket.status === "queued" ? (
          <>
            <button
              type="button"
              data-testid={`kds-ticket-${ticket.id}-bump`}
              disabled={pending}
              onClick={onBump}
              className="flex min-h-14 flex-[2] items-center justify-center rounded-lg bg-ticket-bumped text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              BUMP
            </button>
            <button
              type="button"
              data-testid={`kds-ticket-${ticket.id}-refire`}
              disabled={pending}
              onClick={onRefire}
              className="flex min-h-14 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              REFIRE
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid={`kds-ticket-${ticket.id}-recall`}
            disabled={pending}
            onClick={onRecall}
            className="flex min-h-14 flex-1 items-center justify-center rounded-lg border border-ticket-recalled text-sm font-bold text-ticket-recalled transition-colors hover:bg-ticket-recalled/10 disabled:opacity-50"
          >
            RECALL
          </button>
        )}
      </div>
    </article>
  );
}
