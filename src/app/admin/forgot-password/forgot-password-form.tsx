"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const RATE_LIMITED = "Too many requests. Please wait a few minutes and try again.";
const FAILURE = "Something went wrong. Check your connection and try again.";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/admin/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 202) setSent(true);
      else setError(res.status === 429 ? RATE_LIMITED : res.status === 400 ? "Enter a valid email address." : FAILURE);
    } catch {
      setError(FAILURE);
    }
    setPending(false);
  }

  if (sent) {
    return (
      <div data-testid="admin-forgot-sent" role="status" className="mt-10 space-y-6 text-center">
        <p className="text-sm text-foreground">If that email belongs to an owner account, a reset link is on its way. It works for one hour.</p>
        <Link data-testid="admin-forgot-back" href="/admin/login" className="text-sm font-medium text-primary underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-10 space-y-6" noValidate>
      <div className="space-y-2">
        <label htmlFor="admin-forgot-email" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <input
          id="admin-forgot-email"
          data-testid="admin-forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@restiq.example"
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        {error ? (
          <p role="alert" data-testid="admin-forgot-error" className="text-sm text-error-soft">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" data-testid="admin-forgot-submit" disabled={pending} className="w-full py-6 text-base font-semibold">
        {pending ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/admin/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
