// EXPERIENCE.md's "Session end" state: "A settled or staff-closed session
// lands every phone on a friendly closed state... never a dead screen or
// auth error." The real backend signals this as a 410 with code
// `session_closed` from any `/guest/v1/*` call once the session is inactive
// (restiq-backend `dev` src/guest/cart/cart.service.ts's `loadActiveSession`,
// read directly) - every CAP-2+ screen that talks to /qr/api routes a 410
// here rather than showing a raw error. No such shared state existed on this
// branch before this story, so this is that state, shared by menu browse
// and item detail (and available for later Q-screens to reuse).
export function SessionEndedView() {
  return (
    <main data-testid="qr-session-ended" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-headline text-xl font-semibold text-foreground">This table&apos;s session has ended</h1>
      <p className="mt-4 max-w-sm text-base text-muted-foreground">Scan again to start a new one.</p>
    </main>
  );
}
