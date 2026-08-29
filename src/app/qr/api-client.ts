// Typed client-side access to the backend's /guest/v1 API via the /qr/api
// pass-through (src/app/qr/api/[...path]/route.ts). Mirrors pos/api.ts's
// shape (PosApiError -> GuestApiError, posApi -> guestApi) - same realm-
// isolation posture (AD-4): the guest realm doesn't reach into pos/api.ts
// even though the pattern is identical, it's its own small copy.
//
// The one guest-specific wrinkle: a closed/settled session's every endpoint
// 410s with `session_closed` (SPEC.md Constraints) - callers that care check
// `error.status === 410` rather than treating it as a generic failure (see
// use-cart-poll.ts).
export class GuestApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function guestApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/qr/api/${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new GuestApiError("The API could not be reached", 0);
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new GuestApiError(error?.message ?? "The request failed", res.status, error?.code);
  }
  return body as T;
}
