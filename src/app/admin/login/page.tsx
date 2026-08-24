import { Mail } from "lucide-react";

// Sign-in for returning owners lands in a later story; this only exists so
// the proxy has somewhere to send an unauthenticated /admin request that
// isn't a dead end.
export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-card px-6 py-12 text-center">
      <div className="mx-auto flex w-full max-w-md flex-col items-center" data-testid="admin-login-placeholder">
        <p className="font-headline text-3xl font-bold tracking-tight text-primary">RESTIQ</p>
        <h1 className="font-headline mt-6 text-2xl font-semibold">Sign-in is on its way</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Returning owners will be able to sign in here soon. For now, use the invite link RESTIQ emailed you to set up
          your account.
        </p>
        <a
          href="mailto:support@restiq.example"
          data-testid="admin-login-contact-support"
          className="mt-8 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Mail className="size-4" aria-hidden="true" />
          Contact support
        </a>
      </div>
    </main>
  );
}
