import { ResetPasswordForm } from "./reset-password-form";

// Owner password reset from the emailed link (?token=...) - outside the app shell, no session needed.
export default async function AdminResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <div className="text-center">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <h1 className="font-headline mt-4 text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">You will be signed out everywhere and asked to sign in with the new password.</p>
        </div>
        <ResetPasswordForm token={token ?? ""} />
      </div>
    </main>
  );
}
