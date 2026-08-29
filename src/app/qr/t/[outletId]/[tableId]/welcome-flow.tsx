"use client";

// Q1 Welcome + Q2 Session PIN (CAP-1). One client component covering both
// designed screens as view states (no separate route - EXPERIENCE.md's IA
// treats them as one linear step and nothing else needs to deep-link into
// the middle of starting/joining a session yet).
//
// RECONCILED (restiq-backend PR #69, merged to `dev`): the real backend has
// no per-table session-status lookup, only a per-outlet `qr_ordering`
// availability check (availability.ts). There is no way to know ahead of
// time whether this table already has an open session, so this screen shows
// BOTH affordances - "Start ordering" primary, "Join your table" secondary -
// and discovers the truth reactively: a start that 409s with
// `session_already_open` flips into join mode with a friendly line; a join
// that 404s with `no_open_session` flips back to start mode the same way.
// See welcome-flow-state.ts and wiki/features/qr-self-order.md's
// "Reconciliation" section for the full story.
//
// WCAG 2.1 AA floor (EXPERIENCE.md): labeled fields, visible focus (default
// browser/Tailwind focus rings), aria-live on the state transition (session
// started / joined / mode flip), inline errors via role="alert", solo-friendly
// (starting auto-proceeds to the PIN screen with no extra ceremony).
import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  appendDigit,
  backspacePin,
  initialFlowState,
  isValidName,
  isValidPhone,
  PIN_LENGTH,
  type WelcomeFlowState,
} from "./welcome-flow-state";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

function errorMessage(body: ApiErrorBody, fallback: string): string {
  return body.error?.message ?? fallback;
}

const JOIN_INVITE_NOTICE = "Your table already has an order going - join it with the PIN below.";
const START_INVITE_NOTICE = "This table doesn't have an order started yet - you can start one below.";

export function WelcomeFlow({
  outletId,
  tableId,
}: Readonly<{
  outletId: string;
  tableId: string;
}>) {
  const menuHref = "/qr/menu";
  const [state, setState] = useState<WelcomeFlowState>(initialFlowState);
  // Bumped on every failed join attempt (or a mode flip) to remount JoinForm,
  // clearing its locally-tracked PIN digits back to blank (React key reset,
  // simpler than threading digit-entry state back up through WelcomeFlowState).
  const [joinAttempt, setJoinAttempt] = useState(0);

  async function startSession(name: string, phone: string) {
    setState((s) => (s.step === "start-form" ? { ...s, pending: true, error: null } : s));
    let res: Response;
    try {
      res = await fetch("/qr/auth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outletId, tableId, name, phone }),
      });
    } catch {
      setState({
        step: "start-form",
        name,
        phone,
        error: "Couldn't reach the restaurant - check your connection and try again",
        notice: null,
        pending: false,
      });
      return;
    }
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody & { pin?: string };
    if (!res.ok || typeof body.pin !== "string") {
      if (body.error?.code === "session_already_open") {
        // The truth was "join", not "start" - flip modes with a friendly
        // line rather than an error tone (this isn't a mistake, just a
        // guess the screen couldn't make ahead of time).
        setState({ step: "join-form", name, pin: "", error: null, notice: JOIN_INVITE_NOTICE, pending: false });
        setJoinAttempt((n) => n + 1);
        return;
      }
      setState({
        step: "start-form",
        name,
        phone,
        error: errorMessage(body, "Couldn't start your table session - please try again"),
        notice: null,
        pending: false,
      });
      return;
    }
    // Solo-friendly: starting proceeds straight to the PIN screen, no
    // ceremony (EXPERIENCE.md "The solo lunch").
    setState({ step: "started", pin: body.pin, guestName: name });
  }

  async function joinSession(name: string, pin: string) {
    setState((s) => (s.step === "join-form" ? { ...s, pending: true, error: null } : s));
    let res: Response;
    try {
      res = await fetch("/qr/auth/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outletId, tableId, pin, name }),
      });
    } catch {
      setState({
        step: "join-form",
        name,
        pin: "",
        error: "Couldn't reach the restaurant - check your connection and try again",
        notice: null,
        pending: false,
      });
      setJoinAttempt((n) => n + 1);
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
      if (body.error?.code === "no_open_session") {
        // The truth was "start", not "join" - flip modes with a friendly
        // line, same discipline as the start->join flip above.
        setState({ step: "start-form", name, phone: "", error: null, notice: START_INVITE_NOTICE, pending: false });
        return;
      }
      const fallback =
        res.status === 429
          ? "Too many incorrect attempts - try again shortly"
          : body.error?.code === "invalid_pin"
            ? "That PIN didn't match - ask your table for the 4-digit code"
            : "Couldn't join the table - please try again";
      setState({ step: "join-form", name, pin: "", error: errorMessage(body, fallback), notice: null, pending: false });
      setJoinAttempt((n) => n + 1);
      return;
    }
    setState({ step: "joined", guestName: name });
  }

  function switchToJoin() {
    setState((s) =>
      s.step === "start-form" ? { step: "join-form", name: s.name, pin: "", error: null, notice: null, pending: false } : s,
    );
    setJoinAttempt((n) => n + 1);
  }

  function switchToStart() {
    setState((s) =>
      s.step === "join-form" ? { step: "start-form", name: s.name, phone: "", error: null, notice: null, pending: false } : s,
    );
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col px-6 pb-28 pt-8">
      <div className="mt-8" role="region" aria-live="polite" aria-label="Table session status">
        {state.step === "start-form" ? (
          <StartForm state={state} onSubmit={startSession} onSwitchToJoin={switchToJoin} />
        ) : state.step === "started" ? (
          <StartedPanel pin={state.pin} menuHref={menuHref} />
        ) : state.step === "join-form" ? (
          <JoinForm key={joinAttempt} state={state} onSubmit={joinSession} onSwitchToStart={switchToStart} />
        ) : (
          <JoinedPanel guestName={state.guestName} menuHref={menuHref} />
        )}
      </div>
    </main>
  );
}

function StartForm({
  state,
  onSubmit,
  onSwitchToJoin,
}: Readonly<{
  state: Extract<WelcomeFlowState, { step: "start-form" }>;
  onSubmit: (name: string, phone: string) => void;
  onSwitchToJoin: () => void;
}>) {
  const [name, setName] = useState(state.name);
  const [phone, setPhone] = useState(state.phone);
  const canSubmit = isValidName(name) && isValidPhone(phone) && !state.pending;

  return (
    <form
      data-testid="qr-start-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(name.trim(), phone);
      }}
    >
      <h2 className="font-headline text-2xl font-semibold text-foreground">Welcome, order together with your table.</h2>
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Start table session</p>
        <div className="mt-4">
          <label htmlFor="qr-name" className="text-xs font-medium text-muted-foreground">
            Your name
          </label>
          <input
            id="qr-name"
            data-testid="qr-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Rahul"
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="qr-phone" className="text-xs font-medium text-muted-foreground">
            Phone number
          </label>
          <input
            id="qr-phone"
            data-testid="qr-phone-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit number"
            inputMode="numeric"
            autoComplete="tel"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3 text-base tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {state.notice ? (
        <p data-testid="qr-start-notice" className="mt-4 text-sm text-muted-foreground">
          {state.notice}
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" data-testid="qr-start-error" className="mt-4 text-sm text-error-soft">
          {state.error}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="qr-switch-to-join"
        onClick={onSwitchToJoin}
        className="mt-4 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Already at a table with an order started? Join it
      </button>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <button
          type="submit"
          data-testid="qr-start-submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {state.pending ? "Starting..." : "Start Session"}
        </button>
      </div>
    </form>
  );
}

function StartedPanel({ pin, menuHref }: Readonly<{ pin: string; menuHref: string }>) {
  const [copied, setCopied] = useState(false);

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied - the PIN is already large on screen,
      // so this is a nice-to-have, not the only way to share it.
    }
  }

  return (
    <div data-testid="qr-session-started">
      <div className="flex flex-col items-center text-center">
        <Check className="size-8 rounded-full bg-status-available/20 p-1.5 text-status-available" aria-hidden="true" />
        <h2 className="mt-3 font-headline text-xl font-semibold text-foreground">Session started</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your table is ready. Invite others to order together.</p>
      </div>

      <div className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-6 text-center">
        <p className="text-xs font-medium tracking-wide text-primary">TABLE PIN</p>
        <p
          data-testid="qr-session-pin"
          aria-label={`Table PIN ${pin.split("").join(" ")}`}
          className="mt-2 font-headline text-5xl font-bold tabular-nums tracking-widest text-primary"
        >
          {pin}
        </p>
        <p className="mt-2 text-xs text-primary/80">Share this PIN so friends at your table can join and order</p>
      </div>

      <button
        type="button"
        data-testid="qr-copy-pin"
        onClick={copyPin}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Copy className="size-4" aria-hidden="true" />
        {copied ? "Copied" : "Copy PIN"}
      </button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Everyone at the table adds to one shared order - the bill can be split at payment.
      </p>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Link
          href={menuHref}
          data-testid="qr-browse-menu"
          className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Browse Menu
        </Link>
      </div>
    </div>
  );
}

function JoinForm({
  state,
  onSubmit,
  onSwitchToStart,
}: Readonly<{
  state: Extract<WelcomeFlowState, { step: "join-form" }>;
  onSubmit: (name: string, pin: string) => void;
  onSwitchToStart: () => void;
}>) {
  const [name, setName] = useState(state.name);
  const [nameError, setNameError] = useState<string | null>(null);
  // Digits are tracked locally rather than round-tripped through the
  // parent's WelcomeFlowState - the parent only needs the final 4-digit
  // value on submit, and resets this view (remounting it with a fresh key)
  // after a failed attempt so it starts blank again.
  const [pinState, setPinState] = useState(state.pin);

  function pressDigit(digit: string) {
    if (state.pending) return;
    if (!isValidName(name)) {
      setNameError("Your name is required to join");
      return;
    }
    setNameError(null);
    const next = appendDigit(pinState, digit);
    setPinState(next);
    if (next.length === PIN_LENGTH) onSubmit(name.trim(), next);
  }

  function pressBackspace() {
    if (state.pending) return;
    setPinState(backspacePin(pinState));
  }

  return (
    <div data-testid="qr-join-form">
      <h2 className="font-headline text-2xl font-semibold text-foreground">Join your table.</h2>
      <p className="mt-1 text-sm text-muted-foreground">A friend already started this table. Ask them for the 4-digit table PIN.</p>

      {state.notice ? (
        <p data-testid="qr-join-notice" className="mt-4 text-sm text-muted-foreground">
          {state.notice}
        </p>
      ) : null}

      <div className="mt-6">
        <label htmlFor="qr-join-name" className="text-xs font-medium text-muted-foreground">
          Your name
        </label>
        <input
          id="qr-join-name"
          data-testid="qr-join-name-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setNameError(null);
          }}
          placeholder="E.g. Priya"
          autoComplete="name"
          disabled={state.pending}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {nameError ? (
        <p role="alert" data-testid="qr-join-name-error" className="mt-2 text-sm text-error-soft">
          {nameError}
        </p>
      ) : null}

      <div className="mt-6 flex justify-center gap-4" data-testid="qr-join-pin-dots">
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <span
            key={index}
            data-testid={`qr-join-pin-dot-${index}`}
            className={`size-3.5 rounded-full border border-primary ${index < pinState.length ? "bg-primary" : "bg-transparent"}`}
          />
        ))}
      </div>

      {state.error ? (
        <p role="alert" data-testid="qr-join-error" className="mt-4 text-center text-sm text-error-soft">
          {state.error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"].map((key, index) =>
          key === "" ? (
            <span key={`blank-${index}`} aria-hidden="true" />
          ) : key === "backspace" ? (
            <button
              key="backspace"
              type="button"
              data-testid="qr-join-pin-backspace"
              aria-label="Backspace"
              disabled={state.pending}
              onClick={pressBackspace}
              className="flex size-16 items-center justify-center rounded-lg bg-card text-lg font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              ⌫
            </button>
          ) : (
            <button
              key={key}
              type="button"
              data-testid={`qr-join-pin-digit-${key}`}
              disabled={state.pending}
              onClick={() => pressDigit(key)}
              className="flex size-16 items-center justify-center rounded-lg bg-card text-2xl font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              {key}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        data-testid="qr-switch-to-start"
        onClick={onSwitchToStart}
        className="mt-6 w-full text-center text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Starting a new table instead? Start ordering
      </button>
    </div>
  );
}

function JoinedPanel({ guestName, menuHref }: Readonly<{ guestName: string; menuHref: string }>) {
  return (
    <div data-testid="qr-joined" className="flex flex-col items-center text-center">
      <Check className="size-8 rounded-full bg-status-available/20 p-1.5 text-status-available" aria-hidden="true" />
      <h2 className="mt-3 font-headline text-xl font-semibold text-foreground">You&apos;re in, {guestName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">You&apos;ve joined your table&apos;s shared order.</p>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Link
          href={menuHref}
          data-testid="qr-browse-menu"
          className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Browse Menu
        </Link>
      </div>
    </div>
  );
}
