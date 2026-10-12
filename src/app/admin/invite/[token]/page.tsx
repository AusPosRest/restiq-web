import { Mail } from "lucide-react";
import Link from "next/link";
import { AcceptInviteForm } from "./accept-invite-form";
import { lookupInvite } from "./invite-lookup";

const LINK_CLASSES =
  "inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

// T1 Owner Invite Acceptance - outside the app shell.
export default async function AdminInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await lookupInvite(token);
  const invite = lookup.kind === "ok" ? lookup.invite : null;

  const heading =
    lookup.kind === "used"
      ? "You've already set up your account"
      : lookup.kind === "invalid"
        ? "This invite link doesn't work"
        : invite?.restaurantName
          ? `Set up ${invite.restaurantName}`
          : "Welcome to RESTIQ";
  const subtitle =
    lookup.kind === "used"
      ? "This invite was already used to choose a password. Sign in with it."
      : lookup.kind === "invalid"
        ? "It is invalid or has expired. Ask your RESTIQ contact to send a fresh one."
        : invite
          ? `${invite.firstName ? `Hi ${invite.firstName}. ` : ""}Choose a password for ${invite.email}.`
          : "Set a password to finish setting up your account.";

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <div className="text-center">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <h1 className="font-headline mt-4 text-2xl font-semibold" data-testid="admin-invite-heading">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="admin-invite-for">
            {subtitle}
          </p>
        </div>
        {lookup.kind === "used" ? (
          <div className="mt-10 text-center">
            <Link href="/admin/login" data-testid="admin-invite-sign-in" className={LINK_CLASSES}>
              Sign in
            </Link>
          </div>
        ) : lookup.kind === "invalid" ? (
          <div className="mt-10 text-center">
            <a href="mailto:support@restiq.example" data-testid="admin-invite-support-link" className={LINK_CLASSES}>
              <Mail className="size-4" aria-hidden="true" />
              Contact support
            </a>
          </div>
        ) : (
          <AcceptInviteForm token={token} />
        )}
      </div>
    </main>
  );
}
