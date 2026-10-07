"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MIN_PASSWORD_LENGTH = 10;
const FIELD_ERROR_LENGTH = "Password must be at least 10 characters.";
const FIELD_ERROR_MISMATCH = "Passwords do not match.";
const FAILURE = "Something went wrong. Check your connection and try again.";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [linkProblem, setLinkProblem] = useState<"missing" | "expired" | "invalid" | null>(token ? null : "missing");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setFieldError(null);
    setSubmitError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setFieldError(FIELD_ERROR_LENGTH);
    if (password !== String(form.get("confirm-password") ?? "")) return setFieldError(FIELD_ERROR_MISMATCH);

    setPending(true);
    try {
      const res = await fetch("/admin/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        router.replace("/admin/login?reset=1");
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      const code = (body as { error?: { code?: string } } | null)?.error?.code;
      if (code === "reset_expired") setLinkProblem("expired");
      else if (code === "reset_invalid") setLinkProblem("invalid");
      else setSubmitError(FAILURE);
    } catch {
      setSubmitError(FAILURE);
    }
    setPending(false);
  }

  if (linkProblem) {
    return (
      <div data-testid="admin-reset-link-problem" className="mt-10 space-y-6 text-center">
        <p className="text-sm text-foreground">
          {linkProblem === "expired"
            ? "This reset link has expired. Ask for a new one - links work for one hour."
            : linkProblem === "invalid"
              ? "This reset link is not valid, or it has already been used. Ask for a new one."
              : "This page needs the link from your reset email. Ask for a new one."}
        </p>
        <Link data-testid="admin-reset-request-new" href="/admin/forgot-password" className="inline-flex rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent">
          Send me a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-10 space-y-6" noValidate>
      <div className="space-y-2">
        <label htmlFor="admin-reset-password" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          New password
        </label>
        <input
          id="admin-reset-password"
          data-testid="admin-reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldError !== null || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="admin-reset-confirm" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confirm password
        </label>
        <input
          id="admin-reset-confirm"
          data-testid="admin-reset-confirm"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldError !== null || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        {fieldError ? (
          <p role="alert" data-testid="admin-reset-field-error" className="text-sm text-error-soft">
            {fieldError}
          </p>
        ) : null}
        {submitError ? (
          <p role="alert" data-testid="admin-reset-error" className="text-sm text-error-soft">
            {submitError}
          </p>
        ) : null}
      </div>
      <Button type="submit" data-testid="admin-reset-submit" disabled={pending} className="w-full py-6 text-base font-semibold">
        {pending ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
