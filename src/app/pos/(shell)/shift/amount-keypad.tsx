"use client";

// Shared digit-grid used by every amount entry in this story: the open-shift
// float, a cash movement's amount, and BlindCountKeypad's counted amount
// (close-shift-screen.tsx). EXPERIENCE.md's Interaction Primitives rule:
// numeric entry always goes through a large on-screen keypad component,
// never the OS's native numeric keyboard - so this is a button grid, not an
// <input type="number">. The Accessibility Floor also requires physical
// keyboard input to keep working for testing/demo, so digit/backspace keys
// are wired on top of the click handlers, not instead of them.
import { formatMinor } from "./shift-state";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export interface AmountKeypadProps {
  digits: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  testId: string;
  currency?: string;
  disabled?: boolean;
}

export function AmountKeypad({ digits, onDigit, onBackspace, onClear, testId, currency = "INR", disabled }: Readonly<AmountKeypadProps>) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      onDigit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      onBackspace();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClear();
    }
  }

  return (
    <div data-testid={testId} onKeyDown={handleKeyDown} tabIndex={0} className="flex flex-col items-center gap-4 focus:outline-none">
      <output data-testid={`${testId}-display`} className="font-headline min-w-[10ch] text-center text-5xl font-bold tabular-nums tracking-tight text-foreground">
        {formatMinor(parseInt(digits || "0", 10), currency)}
      </output>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => {
          if (key === "clear") {
            return (
              <button
                key={key}
                type="button"
                data-testid={`${testId}-clear`}
                disabled={disabled}
                onClick={onClear}
                className="flex h-16 w-20 items-center justify-center rounded-lg bg-secondary text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Clear
              </button>
            );
          }
          if (key === "back") {
            return (
              <button
                key={key}
                type="button"
                aria-label="Backspace"
                data-testid={`${testId}-backspace`}
                disabled={disabled}
                onClick={onBackspace}
                className="flex h-16 w-20 items-center justify-center rounded-lg bg-secondary text-lg font-semibold text-secondary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              data-testid={`${testId}-digit-${key}`}
              disabled={disabled}
              onClick={() => onDigit(key)}
              className="flex h-16 w-20 items-center justify-center rounded-lg bg-card text-xl font-semibold tabular-nums text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
