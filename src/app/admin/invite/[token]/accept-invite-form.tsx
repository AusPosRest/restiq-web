"use client";

import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const FIELD_ERROR_LENGTH = "Password must be at least 10 characters.";
const FIELD_ERROR_MISMATCH = "Passwords do not match.";
const GENERIC_FAILURE = "Something went wrong. Check your connection and try again.";
const MIN_PASSWORD_LENGTH = 10;

function isInviteError(status: number, code: string | undefined): boolean {
  if (status === 404 || status === 410) return true;
  return typeof code === "string" && code.toLowerCase().includes("invite");
}

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expiredOrUsed, setExpiredOrUsed] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirm-password") ?? "");

    setFieldError(null);
    setSubmitError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(FIELD_ERROR_LENGTH);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError(FIELD_ERROR_MISMATCH);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/admin/auth/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        router.replace("/admin/onboarding");
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
      if (isInviteError(res.status, error?.code)) {
        setExpiredOrUsed(true);
      } else {
        setSubmitError(error?.message ?? GENERIC_FAILURE);
      }
    } catch {
      setSubmitError(GENERIC_FAILURE);
    }
    setPending(false);
  }

  if (expiredOrUsed) {
    return (
      <div data-testid="admin-accept-invite-invalid" className="mt-10 space-y-6 text-center">
        <p className="text-sm text-foreground">
          This invite link is invalid or has expired. Ask your RESTIQ contact to send a fresh one, or reach out below.
        </p>
        <a
          href="mailto:support@restiq.example"
          data-testid="admin-accept-invite-support-link"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Mail className="size-4" aria-hidden="true" />
          Contact support
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-10 space-y-6" noValidate>
      <div className="space-y-2">
        <label htmlFor="admin-invite-password" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Create password
        </label>
        <input
          id="admin-invite-password"
          data-testid="admin-accept-invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldError !== null || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-invite-confirm-password" className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confirm password
        </label>
        <input
          id="admin-invite-confirm-password"
          data-testid="admin-accept-invite-confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldError !== null || undefined}
          className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        {fieldError ? (
          <p role="alert" data-testid="admin-accept-invite-field-error" className="text-sm text-error-soft">
            {fieldError}
          </p>
        ) : null}
        {submitError ? (
          <p role="alert" data-testid="admin-accept-invite-error" className="text-sm text-error-soft">
            {submitError}
          </p>
        ) : null}
      </div>

      <Button type="submit" data-testid="admin-accept-invite-submit" disabled={pending} className="w-full py-6 text-base font-semibold">
        {pending ? "Setting up your account..." : "Accept invite and continue"}
      </Button>
    </form>
  );
}
