"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const GENERIC_ERROR = "Incorrect email or password";
const LOCKED_OUT_ERROR = "Too many sign-in attempts. Please try again later.";
const FAILURE_ERROR = "Sign-in failed. Check your connection and try again.";

export function LoginForm({ nextPath, sessionExpired }: { nextPath: string; sessionExpired: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (res.ok) {
        router.replace(nextPath);
        return;
      }
      setError(
        res.status === 429
          ? LOCKED_OUT_ERROR
          : res.status === 401 || res.status === 400 || res.status === 409
            ? GENERIC_ERROR
            : FAILURE_ERROR,
      );
    } catch {
      setError(FAILURE_ERROR);
    }
    setPending(false);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-10 space-y-6" noValidate>
      {sessionExpired ? (
        <p
          role="status"
          data-testid="admin-login-expired-banner"
          className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-status-warning"
        >
          Session expired. Sign in again to continue.
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="admin-login-email" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <input
          id="admin-login-email"
          data-testid="admin-login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@restiq.example"
          aria-invalid={error === GENERIC_ERROR || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-login-password" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Password
        </label>
        <input
          id="admin-login-password"
          data-testid="admin-login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error === GENERIC_ERROR || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        {error ? (
          <p role="alert" data-testid="admin-login-error" className="text-sm text-error-soft">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        data-testid="admin-login-submit"
        disabled={pending}
        className="w-full py-6 text-base font-semibold"
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">Got an invite link? Open it to set your password.</p>
    </form>
  );
}
