// Which restaurant lives at this address (restiq-backend D14: <slug>.<base domain>). Server-side only:
// the sign-in pages and the POS PIN route ask the API's public lookup. Anything but a clear answer
// (no match, API down, no address) is null - callers fall back to the generic RESTIQ look.
export interface TenantPublic {
  tenantId: string;
  slug: string;
  displayName: string;
  status: "provisioning" | "active" | "suspended";
  country: "IN" | "AU";
  currency: "INR" | "AUD";
  branding: Record<string, unknown>;
}

/** The address the visitor typed, as this server saw it (behind a proxy it arrives in x-forwarded-host). */
export function hostOf(headers: Pick<Headers, "get">): string | null {
  return (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0]?.trim() || null;
}

export async function fetchTenantByHost(host: string | null): Promise<TenantPublic | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !host) return null;
  try {
    const res = await fetch(`${apiUrl}/public/v1/tenant?host=${encodeURIComponent(host)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as TenantPublic) : null;
  } catch {
    return null;
  }
}
