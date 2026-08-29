// Shouldn't happen - the proxy only lets a request reach any /kds page with
// a valid pos_session, and the login/select-outlet routes always set
// pos_staff alongside it (see src/app/pos/(shell)/shift-bar.tsx's identical
// fallback). Falls back to a plain sign-out link rather than a dead end if
// the display cookie is ever missing anyway.
export function SignedOutNotice() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p data-testid="kds-signed-out-notice" className="font-headline text-lg font-semibold">
        Session display info is missing
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">Sign in again on this display to continue.</p>
      <a
        href="/pos/login?next=/kds"
        data-testid="kds-signed-out-login-link"
        className="rounded-lg border border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        Go to sign in
      </a>
    </main>
  );
}
