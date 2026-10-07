import { ForgotPasswordForm } from "./forgot-password-form";

// Owner "forgot password" - outside the app shell, reachable without a session.
export default function AdminForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <div className="text-center">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <h1 className="font-headline mt-4 text-2xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter the email you use for the Owner Console and we will send you a link.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
