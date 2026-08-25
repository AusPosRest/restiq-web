"use client";

// P11 "no shift open" state: enter the starting float before the main loop
// unlocks (SPEC CAP-10 / EXPERIENCE.md "Shift gates the main loop" - a
// structural precondition, mirroring Tenant Admin's Go-Live gate).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "./amount-keypad";
import { appendDigit, validateOpeningFloat } from "./shift-state";

export function OpenShiftForm({
  busy,
  error,
  onOpen,
}: Readonly<{ busy: boolean; error: string | null; onOpen: (openingFloatMinor: number) => void }>) {
  const [digits, setDigits] = useState("");
  const validationError = validateOpeningFloat(digits);

  return (
    <div data-testid="open-shift-form" className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="font-headline text-2xl font-semibold">Open your shift</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the starting cash float to unlock the till.</p>
      </div>

      <AmountKeypad
        testId="open-shift-keypad"
        digits={digits}
        disabled={busy}
        onDigit={(digit) => setDigits((current) => appendDigit(current, digit))}
        onBackspace={() => setDigits((current) => current.slice(0, -1))}
        onClear={() => setDigits("")}
      />

      {error && (
        <p role="alert" data-testid="open-shift-error" className="text-sm text-status-alert">
          {error}
        </p>
      )}

      <Button
        size="lg"
        data-testid="open-shift-submit"
        disabled={busy || validationError !== null}
        onClick={() => onOpen(parseInt(digits, 10))}
      >
        {busy ? "Opening..." : "Open shift"}
      </Button>
      {!error && validationError && digits.length === 0 && (
        <p data-testid="open-shift-hint" className="text-xs text-muted-foreground">
          {validationError}
        </p>
      )}
    </div>
  );
}
