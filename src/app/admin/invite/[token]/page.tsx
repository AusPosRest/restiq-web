import { AcceptInviteForm } from "./accept-invite-form";

// T1 Owner Invite Acceptance - outside the app shell. There is no invite
// lookup endpoint in the API contract, so this stays generic rather than
// guessing at the owner's name or business until CAP-1 grows one.
export default async function AdminInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <div className="text-center">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <h1 className="font-headline mt-4 text-2xl font-semibold">Welcome to RESTIQ</h1>
          <p className="mt-2 text-sm text-muted-foreground">Set a password to finish setting up your account.</p>
        </div>
        <AcceptInviteForm token={token} />
      </div>
    </main>
  );
}
