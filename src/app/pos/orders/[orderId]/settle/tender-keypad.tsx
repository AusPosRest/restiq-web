"use client";

// TenderKeypad (DESIGN.md's component name: "large numeric keypad + tender
// buttons"). Reuses shift's AmountKeypad + digit-buffer helpers directly
// (appendDigit/digitsToMinor/formatMinor from shift-state.ts) rather than a
// second digit-grid implementation - same component EXPERIENCE.md's
// Interaction Primitives rule (numeric entry always via an on-screen keypad,
// never the OS numeric keyboard) already governs everywhere else in /pos.
// Supports split/multiple tenders (task: "a running remaining to settle
// figure as tenders are added").
//
// RECONCILED (2026-09-02, restiq-web#98): the real backend has no per-tender
// endpoint - every tender rides inside the single `POST bills/:id/finalize`
// call (see bill-state.ts's file header), so "Add tender" now only appends
// to a local, in-memory list (`onAddTender`) that the caller submits
// wholesale on Finalize. Each pending tender is removable (a new
// affordance this needs that the old always-committed-server-side tenders
// never did) since a mis-entered amount has to be fixable before that one
// finalize call, not undone after the fact.
//
// Card terminal (issue #188, restiq-backend#130 - ADR-001): a third method
// that is NOT a pending tender. "Send to terminal" hands the keyed amount to
// `onSendToTerminal`; the caller creates a payment intent and, once the
// terminal approves, the server-written tender arrives in `bill.tenders` and
// is listed here as captured (`capturedTenders`) - never removable, since
// the money already moved.
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "../../../(shell)/shift/amount-keypad";
import { appendDigit, digitsToMinor, formatMinor } from "../../../(shell)/shift/shift-state";
import { TENDER_METHOD_LABEL, type BillTenderView, type PendingTender, type PostableTenderMethod } from "./bill-state";

type KeypadMethod = PostableTenderMethod | "card_terminal";

export interface TenderKeypadProps {
  currency: string;
  remainingMinor: number;
  tenders: PendingTender[];
  /** Server-written electronic tenders already on the bill (isElectronicMethod) - shown as captured, never removable. */
  capturedTenders?: BillTenderView[];
  onAddTender: (method: PostableTenderMethod, amountMinor: number) => void;
  onRemoveTender: (index: number) => void;
  /** Present when the outlet can send an amount to the card terminal. */
  onSendToTerminal?: (amountMinor: number) => void;
  terminalBusy?: boolean;
}

const METHODS: PostableTenderMethod[] = ["cash", "upi_manual"];

export function TenderKeypad({
  currency,
  remainingMinor,
  tenders,
  capturedTenders = [],
  onAddTender,
  onRemoveTender,
  onSendToTerminal,
  terminalBusy = false,
}: Readonly<TenderKeypadProps>) {
  const [method, setMethod] = useState<KeypadMethod>("cash");
  const [digits, setDigits] = useState("");
  const amountMinor = digitsToMinor(digits);
  const isTerminal = method === "card_terminal";
  const canAdd = amountMinor > 0 && (!isTerminal || (amountMinor <= remainingMinor && !terminalBusy));
  const methods: KeypadMethod[] = onSendToTerminal ? [...METHODS, "card_terminal"] : METHODS;

  function submit(minor: number) {
    if (minor <= 0) return;
    if (isTerminal) onSendToTerminal?.(minor);
    else onAddTender(method, minor);
    setDigits("");
  }

  return (
    <section data-testid="tender-keypad" className="flex min-h-fit flex-1 flex-col gap-3 p-4">
      <div className="text-center">
        <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remaining amount due</p>
        <p data-testid="tender-remaining" className="font-headline text-3xl font-bold tabular-nums text-foreground">
          {formatMinor(remainingMinor, currency)}
        </p>
      </div>

      {(capturedTenders.length > 0 || tenders.length > 0) && (
        <ul data-testid="tender-captured-list" className="flex flex-col gap-1.5">
          {capturedTenders.map((tender) => (
            <li
              key={tender.id}
              data-testid={`tender-captured-server-${tender.id}`}
              className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="text-status-available">
                {TENDER_METHOD_LABEL[tender.method]} <span className="text-muted-foreground">· captured</span>
              </span>
              <span className="tabular-nums font-semibold text-foreground">{formatMinor(tender.amountMinor, currency)}</span>
            </li>
          ))}
          {tenders.map((tender, index) => (
            <li
              key={index}
              data-testid={`tender-captured-${index}`}
              className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="text-status-available">{TENDER_METHOD_LABEL[tender.method]}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-semibold text-foreground">{formatMinor(tender.amountMinor, currency)}</span>
                <button
                  type="button"
                  data-testid={`tender-remove-${index}`}
                  aria-label="Remove this tender"
                  onClick={() => onRemoveTender(index)}
                  className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-status-alert"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="font-label mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment method</p>
        <div data-testid="tender-method-group" className={`grid gap-2 ${methods.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {methods.map((option) => (
            <button
              key={option}
              type="button"
              data-testid={`tender-method-${option}`}
              aria-pressed={method === option}
              onClick={() => setMethod(option)}
              className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                method === option ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"
              }`}
            >
              {TENDER_METHOD_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-fit flex-1 flex-col items-center justify-center gap-2">
        <AmountKeypad
          testId="tender-keypad-amount"
          digits={digits}
          currency={currency}
          onDigit={(digit) => setDigits((current) => appendDigit(current, digit))}
          onBackspace={() => setDigits((current) => current.slice(0, -1))}
          onClear={() => setDigits("")}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="tender-fill-remaining"
          disabled={remainingMinor <= 0 || (isTerminal && terminalBusy)}
          onClick={() => submit(remainingMinor)}
        >
          {isTerminal ? "Send exact remaining" : "Exact remaining"} · {formatMinor(remainingMinor, currency)}
        </Button>
      </div>

      <Button size="lg" data-testid={isTerminal ? "tender-send-terminal" : "tender-add"} disabled={!canAdd} onClick={() => submit(amountMinor)}>
        {isTerminal ? (terminalBusy ? "Sending…" : "Send to terminal") : `Add ${TENDER_METHOD_LABEL[method]} tender`}
      </Button>
    </section>
  );
}
