// Typed client-side access to the backend API via the /admin/api pass-through.
import type { ChecklistState } from "./checklist-state";
import type { MenuImportDraft, MenuImportEditableField } from "./menu-import-state";

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

// uploadMenuImport can't reuse adminApi: it must send a FormData body and let
// the browser set its own multipart content-type (with boundary) - adminApi
// always forces application/json.
export async function uploadMenuImport(file: File): Promise<MenuImportDraft> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch("/admin/api/menu-import/upload", { method: "POST", body });
  } catch {
    throw new AdminApiError("The API could not be reached", 0);
  }
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AdminApiError(error?.message ?? "The upload failed", res.status, error?.code);
  }
  return payload as MenuImportDraft;
}

// The backend's PATCH takes a batch of per-item edits and returns the full,
// re-authoritative draft (same "no extra fetch needed" shape as the
// checklist's completeStep) - one field on one item is just a batch of one.
export function updateMenuImportItem(
  importId: string,
  itemId: string,
  field: MenuImportEditableField,
  value: string | number,
): Promise<MenuImportDraft> {
  return adminApi<MenuImportDraft>(`menu-import/${importId}`, {
    method: "PATCH",
    body: JSON.stringify({ items: [{ id: itemId, [field]: value }] }),
  });
}

export interface MenuImportCommitResult {
  importId: string;
  committedAt: string;
  categories: Array<{ id: string; name: string }>;
  items: Array<{ id: string; name: string; shortName: string; categoryId: string; price: { id: string; priceMinor: number; currency: string } }>;
}

export function commitMenuImport(importId: string): Promise<MenuImportCommitResult> {
  return adminApi<MenuImportCommitResult>(`menu-import/${importId}/commit`, { method: "POST" });
}
