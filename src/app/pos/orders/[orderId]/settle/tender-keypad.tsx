"use client";

// TenderKeypad (DESIGN.md's component name: "large numeric keypad + tender
// buttons"). Reuses shift's AmountKeypad + digit-buffer helpers directly
// (appendDigit/digitsToMinor/formatMinor from shift-state.ts) rather than a
// second digit-grid implementation - same component EXPERIENCE.md's
// Interaction Primitives rule (numeric entry always via an on-screen keypad,
// never the OS numeric keyboard) already governs everywhere else in /pos.
// Supports split/multiple tenders (task: "a running remaining to settle
// figure as tenders are added") - each Add tender call posts one tender and
// the parent replaces its BillView wholesale from the response, same
// optimistic-free pattern as order-taking-view.tsx's line mutations.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "../../../(shell)/shift/amount-keypad";
import { appendDigit, digitsToMinor, formatMinor } from "../../../(shell)/shift/shift-state";
import { TENDER_METHOD_LABEL, type BillTenderMethod, type BillTenderView } from "./bill-state";

export interface TenderKeypadProps {
  currency: string;
  remainingMinor: number;
  tenders: BillTenderView[];
  busy: boolean;
  error: string | null;
  onAddTender: (method: BillTenderMethod, amountMinor: number) => void;
}

const METHODS: BillTenderMethod[] = ["cash", "upi"];

export function TenderKeypad({ currency, remainingMinor, tenders, busy, error, onAddTender }: Readonly<TenderKeypadProps>) {
  const [method, setMethod] = useState<BillTenderMethod>("cash");
  const [digits, setDigits] = useState("");
  const amountMinor = digitsToMinor(digits);
  const canAdd = !busy && amountMinor > 0;

  function submit(minor: number) {
    if (busy || minor <= 0) return;
    onAddTender(method, minor);
    setDigits("");
  }

  return (
    <section data-testid="tender-keypad" className="flex flex-1 flex-col gap-4 p-6">
      <div className="text-center">
        <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remaining amount due</p>
        <p data-testid="tender-remaining" className="font-headline text-4xl font-bold tabular-nums text-foreground">
          {formatMinor(remainingMinor, currency)}
        </p>
      </div>

      {tenders.length > 0 && (
        <ul data-testid="tender-captured-list" className="flex flex-col gap-1.5">
          {tenders.map((tender) => (
            <li
              key={tender.id}
              data-testid={`tender-captured-${tender.id}`}
              className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="text-status-available">{TENDER_METHOD_LABEL[tender.method]} captured</span>
              <span className="tabular-nums font-semibold text-foreground">{formatMinor(tender.amountMinor, currency)}</span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="font-label mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment method</p>
        <div data-testid="tender-method-group" className="grid grid-cols-2 gap-2">
          {METHODS.map((option) => (
            <button
              key={option}
              type="button"
              data-testid={`tender-method-${option}`}
              aria-pressed={method === option}
              disabled={busy}
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

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <AmountKeypad
          testId="tender-keypad-amount"
          digits={digits}
          currency={currency}
          disabled={busy}
          onDigit={(digit) => setDigits((current) => appendDigit(current, digit))}
          onBackspace={() => setDigits((current) => current.slice(0, -1))}
          onClear={() => setDigits("")}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="tender-fill-remaining"
          disabled={busy || remainingMinor <= 0}
          onClick={() => submit(remainingMinor)}
        >
          Exact remaining · {formatMinor(remainingMinor, currency)}
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="tender-error" className="text-center text-sm text-status-alert">
          {error}
        </p>
      )}

      <Button size="lg" data-testid="tender-add" disabled={!canAdd} onClick={() => submit(amountMinor)}>
        {busy ? "Adding…" : `Add ${TENDER_METHOD_LABEL[method]} tender`}
      </Button>
    </section>
  );
}
