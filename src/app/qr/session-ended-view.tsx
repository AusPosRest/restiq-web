// EXPERIENCE.md's "Session end" state: "A settled or staff-closed session
// lands every phone on a friendly closed state... never a dead screen or
// auth error." The real backend signals this as a 410 with code
// `session_closed` from any `/guest/v1/*` call once the session is inactive
// (restiq-backend `dev` src/guest/cart/cart.service.ts's `loadActiveSession`,
// read directly) - every CAP-2+ screen that talks to /qr/api routes a 410
// here rather than showing a raw error. No such shared state existed on this
// branch before this story, so this is that state, shared by menu browse
// and item detail (and available for later Q-screens to reuse).
//
// CAP-5 (checkout) adds the `variant` prop: the backend reports a
// staff-abort and a normal bill-settlement the exact same way (410
// `session_closed`, no code to tell them apart - see bills.service.ts's
// `assertSessionActive`), but checkout is specifically the money-settling
// screen, so a 410 reached from there almost always means the table's own
// bill just finished, not a staff abort. `variant="settled"` renders the
// warmer "thanks, complete" framing for that case; every existing caller
// that renders no props keeps the original closed-session copy unchanged.
export function SessionEndedView({ variant = "closed" }: Readonly<{ variant?: "closed" | "settled" }> = {}) {
  const copy =
    variant === "settled"
      ? { heading: "Thanks for dining with us!", body: "Your table's bill is settled. Scan again next time to start a new order." }
      : { heading: "This table's session has ended", body: "Scan again to start a new one." };

  return (
    <main data-testid="qr-session-ended" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-headline text-xl font-semibold text-foreground">{copy.heading}</h1>
      <p className="mt-4 max-w-sm text-base text-muted-foreground">{copy.body}</p>
    </main>
  );
}
