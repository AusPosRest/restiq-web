"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const GENERIC_ERROR = "Incorrect email or password";
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
      const res = await fetch("/ops/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (res.ok) {
        router.replace(nextPath);
        return;
      }
      setError(res.status === 401 || res.status === 400 ? GENERIC_ERROR : FAILURE_ERROR);
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
          data-testid="ops-login-expired-banner"
          className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-status-warning"
        >
          Session expired. Sign in again to continue.
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="ops-login-email" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <input
          id="ops-login-email"
          data-testid="ops-login-email"
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
        <label htmlFor="ops-login-password" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Password
        </label>
        <input
          id="ops-login-password"
          data-testid="ops-login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error === GENERIC_ERROR || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        {error ? (
          <p role="alert" data-testid="ops-login-error" className="text-sm text-error-soft">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        data-testid="ops-login-submit"
        disabled={pending}
        className="w-full py-6 text-base font-semibold"
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">Internal RESTIQ staff only</p>
    </form>
  );
}
