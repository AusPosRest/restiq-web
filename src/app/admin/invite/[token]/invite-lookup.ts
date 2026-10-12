export interface InviteDetails {
  restaurantName: string;
  email: string;
  firstName: string;
}

export type InviteLookup =
  | { kind: "ok"; invite: InviteDetails }
  /** Already accepted (409 invite_already_used): the owner should sign in, not set a password again. */
  | { kind: "used" }
  /** Unknown token or expired invite (400 invite_invalid / invite_expired). */
  | { kind: "invalid" }
  /** The API could not be asked - show the form; it reports the real error on submit. */
  | { kind: "unknown" };

// restiq-backend#193: who this invite is for. PE-31: a used or invalid link says so up front instead of
// showing a password form that only fails after it is filled in.
export async function lookupInvite(token: string): Promise<InviteLookup> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { kind: "unknown" };
  try {
    const res = await fetch(`${apiUrl}/admin/v1/auth/invite-details`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (res.ok) return { kind: "ok", invite: (await res.json()) as InviteDetails };
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    const code = body?.error?.code;
    if (code === "invite_already_used") return { kind: "used" };
    if (code === "invite_invalid" || code === "invite_expired" || res.status === 400) return { kind: "invalid" };
    return { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}
