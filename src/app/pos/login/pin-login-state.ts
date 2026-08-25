// Pure P1 PIN login logic (CAP-1) - digit entry, lockout countdown math, and
// the outlet-picker step - kept free of React so it's unit-testable without a
// DOM, mirroring staff-state.ts/devices-state.ts's split between logic and UI.
//
// StaffSummary/OutletSummary here mirror restiq-backend's real
// feature/44-pos-auth-clock contract (see ../auth/types.ts, imported by the
// route handlers) - kept as a separate local re-export rather than importing
// across the route/component boundary, same convention table-map-state.ts
// uses for its own view types.
import type { OutletSummary, StaffSummary } from "../auth/types";

export const PIN_LENGTH = 4;

export function appendDigit(pin: string, digit: string): string {
  if (pin.length >= PIN_LENGTH) return pin;
  return pin + digit;
}

export function backspacePin(pin: string): string {
  return pin.slice(0, -1);
}

/** Whole seconds remaining until `lockedUntil`, floored at 0. Pure - mirrors devices-state.ts#secondsRemaining so the countdown math is unit-tested the same way. */
export function secondsRemaining(lockedUntil: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(lockedUntil) - now) / 1000));
}

export type { StaffSummary, OutletSummary };

/**
 * The screen's state machine: entering a PIN, choosing an outlet once the
 * backend says there's more than one (holding the pendingToken it issued to
 * resubmit to /pos/auth/select-outlet), or locked out after 5 wrong attempts
 * (SPEC CAP-1 success signal).
 */
export type PinScreenState =
  | { step: "entering-pin"; pin: string; error: string | null }
  | { step: "choosing-outlet"; pendingToken: string; staff: StaffSummary; outlets: OutletSummary[] }
  | { step: "locked"; lockedUntil: string };

export const INITIAL_PIN_STATE: PinScreenState = { step: "entering-pin", pin: "", error: null };
