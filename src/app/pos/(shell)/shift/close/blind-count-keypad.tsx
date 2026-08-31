"use client";

// P12 step 1 (EXPERIENCE.md's BlindCountKeypad component pattern): counted-
// amount entry only. There is no expected-amount field anywhere in this
// component's props, state, or render output - not grayed out, not blurred,
// simply never present - matching DESIGN.md's exact wording ("visually
// absent... until the counted amount is submitted"). See
// close-shift-screen.tsx's file header for how the parent enforces the
// network side of that same rule.
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "../amount-keypad";
import { appendDigit, digitsToMinor, validateCountedCash } from "../shift-state";

export interface BlindCountKeypadProps {
  digits: string;
  onDigitsChange: (digits: string) => void;
  busy: boolean;
  error: string | null;
  currency: string;
  onSubmit: (countedCashMinor: number) => void;
}

export function BlindCountKeypad({ digits, onDigitsChange, busy, error, currency, onSubmit }: Readonly<BlindCountKeypadProps>) {
  const validationError = validateCountedCash(digits);

  return (
    <div data-testid="blind-count-keypad" className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="font-headline text-2xl font-semibold">Count the drawer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Count cash before viewing expected total.</p>
      </div>

      <AmountKeypad
        testId="blind-count"
        digits={digits}
        disabled={busy}
        currency={currency}
        onDigit={(digit) => onDigitsChange(appendDigit(digits, digit))}
        onBackspace={() => onDigitsChange(digits.slice(0, -1))}
        onClear={() => onDigitsChange("")}
      />

      {error && (
        <p role="alert" data-testid="blind-count-error" className="text-sm text-status-alert">
          {error}
        </p>
      )}

      <Button size="lg" data-testid="blind-count-submit" disabled={busy || validationError !== null} onClick={() => onSubmit(digitsToMinor(digits))}>
        {busy ? "Submitting..." : "Submit count"}
      </Button>
    </div>
  );
}
