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
 * The screen's state machine. `sessionOpen` (from the server-side table
 * status lookup) decides the starting step: a fresh table starts in
 * "start-form" ("Start ordering" per SPEC/EXPERIENCE.md IA), a table with a
 * session already open starts in "join-form" ("Join your table").
 */
export type WelcomeFlowState =
  | { step: "start-form"; name: string; phone: string; error: string | null; pending: boolean }
  | { step: "started"; pin: string; guestName: string }
  | { step: "join-form"; name: string; pin: string; error: string | null; pending: boolean }
  | { step: "joined"; guestName: string };

export function initialFlowState(sessionOpen: boolean): WelcomeFlowState {
  return sessionOpen
    ? { step: "join-form", name: "", pin: "", error: null, pending: false }
    : { step: "start-form", name: "", phone: "", error: null, pending: false };
}
