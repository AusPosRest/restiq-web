import { AcceptInviteForm } from "./accept-invite-form";

interface InviteDetails {
  restaurantName: string;
  email: string;
  firstName: string;
}

// restiq-backend#193: who this invite is for. A failed lookup just falls back
// to the generic copy - the form still shows the real error on submit.
async function fetchInviteDetails(token: string): Promise<InviteDetails | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl}/admin/v1/auth/invite-details`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as InviteDetails) : null;
  } catch {
    return null;
  }
}

// T1 Owner Invite Acceptance - outside the app shell.
export default async function AdminInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await fetchInviteDetails(token);
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <div className="text-center">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <h1 className="font-headline mt-4 text-2xl font-semibold" data-testid="admin-invite-heading">
            {invite?.restaurantName ? `Set up ${invite.restaurantName}` : "Welcome to RESTIQ"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="admin-invite-for">
            {invite ? `${invite.firstName ? `Hi ${invite.firstName}. ` : ""}Choose a password for ${invite.email}.` : "Set a password to finish setting up your account."}
          </p>
        </div>
        <AcceptInviteForm token={token} />
      </div>
    </main>
  );
}
