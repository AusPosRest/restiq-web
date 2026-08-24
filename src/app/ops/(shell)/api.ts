// Typed client-side access to the console API via the /ops/api pass-through.
export class OpsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function opsApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/ops/api/${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new OpsApiError("The console API could not be reached", 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new OpsApiError(error?.message ?? "The request failed", res.status, error?.code);
  }
  return body as T;
}

// --- Response shapes served by the backend directory endpoints.

export interface TenantListItem {
  id: string;
  name: string;
  country: string;
  status: string;
  plan: string;
  outletCount: number;
  health: string;
  createdAt: string;
}

export interface TenantListResult {
  tenants: TenantListItem[];
  nextCursor: string | null;
  total: number;
}

export interface OwnerInvite {
  email: string;
  firstName: string;
  lastName: string;
  status: "pending" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    registeredAddress: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    country: string;
    status: string;
    plan: string;
    billingPeriod: string;
    brandingTokens: Record<string, string>;
    region: string;
    createdAt: string;
  };
  taxRegistrations: Array<{
    registrationType: string;
    registrationNumber: string;
    legalEntityName: string;
    taxProfile: string;
    fssaiLicense: string | null;
    compositionScheme: boolean;
  }>;
  brands: Array<{ id: string; name: string }>;
  outlets: Array<{
    id: string;
    name: string;
    brandId: string;
    brandName: string;
    address: string;
    type: string;
    timezone: string;
  }>;
  rolesCount: number;
  ownerInvite: OwnerInvite | null;
  capabilities: Array<{ key: string; enabled: boolean }>;
}
