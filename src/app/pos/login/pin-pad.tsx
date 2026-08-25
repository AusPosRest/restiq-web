"use client";

// P1 PIN Login (CAP-1) - full-screen numeric keypad, auto-submitting at 4
// digits (the design's keypad grid has no explicit confirm key). Handles the
// three states pin-login-state.ts defines: entering a PIN, choosing an
// outlet (only when the tenant has more than one - SPEC constraint), and a
// live lockout countdown after 5 wrong attempts (SPEC CAP-1 success signal).
// EXPERIENCE.md's Accessibility Floor also asks for physical-keyboard entry
// even though the target device is touch-only, so digit keys and Backspace
// work alongside the on-screen buttons.
//
// Verified against restiq-backend's real feature/44-pos-auth-clock contract
// (src/pos/auth/lockout.ts, auth.service.ts, read directly): a wrong PIN
// returns just `{code, message}` - no attemptsRemaining - and a lockout
// returns `{code: "locked_out", message}` with no lockedUntil timestamp
// either. The 30s window is a fixed backend constant (lockout.ts's
// LOCKOUT_MS), not something the response carries, so the client times the
// countdown off its own clock the moment the 429 arrives - same fixed
// window the static caption below already advertised.
import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  appendDigit,
  backspacePin,
  INITIAL_PIN_STATE,
  PIN_LENGTH,
  secondsRemaining,
  type OutletSummary,
  type PinScreenState,
  type StaffSummary,
} from "./pin-login-state";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"] as const;
// Mirrors restiq-backend's lockout.ts LOCKOUT_MS exactly.
const LOCKOUT_MS = 30_000;

interface ErrorBody {
  code?: string;
  message?: string;
  // Our own route handler's synthesized errors (validation/misconfigured/
  // upstream_unreachable) nest under `error`; the backend's own errors,
  // passed through untouched, don't. Read either shape.
  error?: { code?: string; message?: string };
}

function errorMessage(body: ErrorBody, fallback: string): string {
  return body.error?.message ?? body.message ?? fallback;
}

interface AuthenticatedBody {
  status: "authenticated";
  staff: StaffSummary;
  outlet: OutletSummary;
}

interface SelectOutletBody {
  status: "select_outlet";
  pendingToken: string;
  staff: StaffSummary;
  outlets: OutletSummary[];
}

type LoginOkBody = AuthenticatedBody | SelectOutletBody;

type SubmitResult =
  | { kind: "success" }
  | { kind: "outlet_selection"; pendingToken: string; staff: StaffSummary; outlets: OutletSummary[] }
  | { kind: "invalid"; message: string }
  | { kind: "locked"; lockedUntil: string }
  | { kind: "failure"; message: string };

async function postJson(path: string, body: unknown): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "failure", message: "Sign-in failed. Check your connection and try again." };
  }

  if (res.ok) {
    const data = (await res.json().catch(() => null)) as LoginOkBody | null;
    if (data?.status === "select_outlet") {
      return { kind: "outlet_selection", pendingToken: data.pendingToken, staff: data.staff, outlets: data.outlets };
    }
    return { kind: "success" };
  }

  if (res.status === 429) {
    // Computed here (a plain module-level function, not inside the
    // component) rather than in the click-handler chain that consumes it -
    // React's purity rule disallows calling Date.now() from a component's
    // render-associated functions, even ones only ever invoked from an
    // event handler.
    return { kind: "locked", lockedUntil: new Date(Date.now() + LOCKOUT_MS).toISOString() };
  }
  const errBody = (await res.json().catch(() => ({}))) as ErrorBody;
  if (res.status === 401) {
    return { kind: "invalid", message: errorMessage(errBody, "Incorrect PIN") };
  }
  return { kind: "failure", message: errorMessage(errBody, "Sign-in failed. Check your connection and try again.") };
}

function submitPin(pin: string): Promise<SubmitResult> {
  return postJson("/pos/auth/login", { pin });
}

function submitOutletSelection(pendingToken: string, outletId: string): Promise<SubmitResult> {
  return postJson("/pos/auth/select-outlet", { pendingToken, outletId });
}

export function PinPad({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [state, setState] = useState<PinScreenState>(INITIAL_PIN_STATE);
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live lockout countdown, timed off this tab's own clock from the moment
  // the 429 arrived (see file header - the backend's fixed 30s window isn't
  // echoed back in the response) - ticks every second and clears the lock as
  // soon as real elapsed time says it has expired.
  useEffect(() => {
    if (state.step !== "locked") return;
    const lockedUntil = state.lockedUntil;
    const tick = () => {
      const secs = secondsRemaining(lockedUntil, Date.now());
      if (secs <= 0) setState(INITIAL_PIN_STATE);
      else setRemaining(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  function handleResult(result: SubmitResult) {
    if (result.kind === "success") {
      router.replace(nextPath);
      return;
    }
    if (result.kind === "outlet_selection") {
      setState({ step: "choosing-outlet", pendingToken: result.pendingToken, staff: result.staff, outlets: result.outlets });
      return;
    }
    if (result.kind === "locked") {
      setState({ step: "locked", lockedUntil: result.lockedUntil });
      return;
    }
    setState({ step: "entering-pin", pin: "", error: result.message });
  }

  async function attemptLogin(pin: string) {
    setPending(true);
    const result = await submitPin(pin);
    setPending(false);
    handleResult(result);
  }

  async function attemptOutletSelection(pendingToken: string, outletId: string) {
    setPending(true);
    const result = await submitOutletSelection(pendingToken, outletId);
    setPending(false);
    handleResult(result);
  }

  function pressDigit(digit: string) {
    if (state.step !== "entering-pin" || pending) return;
    const pin = appendDigit(state.pin, digit);
    setState({ step: "entering-pin", pin, error: null });
    if (pin.length === PIN_LENGTH) void attemptLogin(pin);
  }

  function pressBackspace() {
    if (state.step !== "entering-pin" || pending) return;
    setState({ step: "entering-pin", pin: backspacePin(state.pin), error: null });
  }

  function pickOutlet(outletId: string) {
    if (state.step !== "choosing-outlet" || pending) return;
    void attemptOutletSelection(state.pendingToken, outletId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key >= "0" && event.key <= "9") pressDigit(event.key);
    else if (event.key === "Backspace") pressBackspace();
  }

  const pin = state.step === "entering-pin" ? state.pin : "";

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-testid="pos-pin-pad"
      className="mx-auto flex w-full max-w-sm flex-col items-center outline-none"
    >
      {state.step === "choosing-outlet" ? (
        <OutletPicker outlets={state.outlets} pending={pending} onPick={pickOutlet} />
      ) : state.step === "locked" ? (
        <LockedPanel remaining={remaining} />
      ) : (
        <>
          <h1 className="font-headline text-xl font-semibold text-foreground">Enter PIN to Unlock</h1>

          <div className="mt-6 flex gap-4" data-testid="pos-pin-dots">
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <span
                key={index}
                data-testid={`pos-pin-dot-${index}`}
                className={`size-3.5 rounded-full border border-primary ${index < pin.length ? "bg-primary" : "bg-transparent"}`}
              />
            ))}
          </div>

          {state.error ? (
            <p role="alert" data-testid="pos-pin-error" className="mt-4 text-sm text-error-soft">
              {state.error}
            </p>
          ) : (
            <p className="mt-4 text-sm text-transparent" aria-hidden="true">
              placeholder
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            {DIGIT_KEYS.map((key, index) =>
              key === "" ? (
                <span key={`blank-${index}`} aria-hidden="true" />
              ) : key === "backspace" ? (
                <button
                  key="backspace"
                  type="button"
                  data-testid="pos-pin-backspace"
                  aria-label="Backspace"
                  disabled={pending}
                  onClick={pressBackspace}
                  className="flex size-16 items-center justify-center rounded-lg bg-card text-lg font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <Delete className="size-5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  key={key}
                  type="button"
                  data-testid={`pos-pin-digit-${key}`}
                  disabled={pending}
                  onClick={() => pressDigit(key)}
                  className="flex size-16 items-center justify-center rounded-lg bg-card text-2xl font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {key}
                </button>
              ),
            )}
          </div>

          <p className="mt-8 font-headline text-sm font-semibold text-primary">Clock In / Out</p>
          <p className="mt-1 text-xs text-muted-foreground">5 attempts, then 30 second lockout</p>
        </>
      )}
    </div>
  );
}

function OutletPicker({
  outlets,
  pending,
  onPick,
}: Readonly<{ outlets: OutletSummary[]; pending: boolean; onPick: (outletId: string) => void }>) {
  return (
    <div data-testid="pos-outlet-picker" className="w-full">
      <h1 className="font-headline text-xl font-semibold text-foreground">Choose your outlet</h1>
      <p className="mt-1 text-sm text-muted-foreground">You&apos;re signed in at more than one location.</p>
      <div className="mt-6 flex flex-col gap-3">
        {outlets.map((outlet) => (
          <button
            key={outlet.id}
            type="button"
            data-testid={`pos-outlet-${outlet.id}`}
            disabled={pending}
            onClick={() => onPick(outlet.id)}
            className="rounded-lg border border-border bg-card px-4 py-4 text-left text-base font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {outlet.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function LockedPanel({ remaining }: Readonly<{ remaining: number }>) {
  return (
    <div data-testid="pos-pin-locked" className="flex flex-col items-center text-center">
      <h1 className="font-headline text-xl font-semibold text-foreground">Terminal locked</h1>
      <p className="mt-2 text-sm text-muted-foreground">Too many incorrect attempts.</p>
      <p className="mt-6 font-headline text-4xl font-bold tabular-nums text-primary" data-testid="pos-pin-lockout-countdown">
        {remaining}s
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Try again shortly</p>
    </div>
  );
}
