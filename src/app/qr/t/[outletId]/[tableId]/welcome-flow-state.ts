// Pure Q1/Q2 flow logic (CAP-1) - form validation, PIN digit entry - kept
// free of React so it's unit-testable without a DOM, mirroring
// pos/login/pin-login-state.ts's split between logic and UI.
export const PIN_LENGTH = 4;
const PHONE_PATTERN = /^\d{10}$/;

export function appendDigit(pin: string, digit: string): string {
  if (pin.length >= PIN_LENGTH) return pin;
  return pin + digit;
}

export function backspacePin(pin: string): string {
  return pin.slice(0, -1);
}

export function isValidName(name: string): boolean {
  return name.trim().length > 0;
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

/**
 * The screen's state machine. There is no backend lookup that says whether a
 * table already has a session open (the real contract only exposes a
 * per-outlet `qr_ordering` availability check - see availability.ts), so
 * both affordances are offered up front and the screen discovers the truth
 * reactively from the start/join responses themselves: a start that 409s
 * with `session_already_open` flips into "join-form" with a friendly
 * `notice`; a join that 404s with `no_open_session` flips back to
 * "start-form" the same way. `notice` is a non-error informational line
 * (distinct from `error`, which is a failed submission on the *current*
 * mode) shown once, right after such a flip.
 */
export type WelcomeFlowState =
  | { step: "start-form"; name: string; phone: string; error: string | null; notice: string | null; pending: boolean }
  | { step: "started"; pin: string; guestName: string }
  | { step: "join-form"; name: string; pin: string; error: string | null; notice: string | null; pending: boolean }
  | { step: "joined"; guestName: string };

export function initialFlowState(): WelcomeFlowState {
  return { step: "start-form", name: "", phone: "", error: null, notice: null, pending: false };
}
