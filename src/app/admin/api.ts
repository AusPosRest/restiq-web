// Typed client-side access to the backend API via the /admin/api pass-through.
import type { ChecklistState } from "./checklist-state";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/admin/api/${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AdminApiError("The API could not be reached", 0);
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AdminApiError(error?.message ?? "The request failed", res.status, error?.code);
  }
  return body as T;
}

export function fetchChecklist(): Promise<ChecklistState> {
  return adminApi<ChecklistState>("checklist");
}

export function completeStep(step: string): Promise<ChecklistState> {
  return adminApi<ChecklistState>(`checklist/${step}`, { method: "PATCH", body: JSON.stringify({ completed: true }) });
}

export interface GoLiveOutcome {
  ok: boolean;
  tenantStatus?: string;
  missingSteps?: string[];
}

// go-live's failure shape carries missingSteps inside the error envelope, so
// this can't reuse adminApi's throw-on-!ok helper without losing that detail.
export async function goLive(): Promise<GoLiveOutcome> {
  let res: Response;
  try {
    res = await fetch("/admin/api/checklist/go-live", { method: "POST", headers: { "content-type": "application/json" } });
  } catch {
    return { ok: false };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const tenant = (body as { tenant?: { status?: string } } | null)?.tenant;
    return { ok: true, tenantStatus: tenant?.status };
  }
  const error = (body as { error?: { missingSteps?: string[] } } | null)?.error;
  return { ok: false, missingSteps: error?.missingSteps };
}
