// Typed client-side access to the backend's real, merged /kitchen/v1 API
// (restiq-backend#70, kitchen-display CAP-1, issue #67) via the /kds/api
// pass-through. Mirrors src/app/pos/api.ts's shape (PosApiError -> KdsApiError,
// posApi -> kdsApi). Shapes below are copied verbatim from
// restiq-backend's src/kitchen/tickets.dtos.ts - read directly, not guessed
// (this story's brief: "read story 1's real committed ticket API before
// wiring"). No request bodies on bump/recall/refire and no actor
// attribution anywhere in this API - an approved decision (SPEC open
// question resolved "no" - shared station screen, FR-34), not an omission.
export class KdsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function kdsApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/kds/api/${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new KdsApiError("The API could not be reached", 0);
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new KdsApiError(error?.message ?? "The request failed", res.status, error?.code);
  }
  return body as T;
}

export interface StationView {
  id: string;
  name: string;
  ageingThresholdMinutes: number;
}

export interface TicketLineModifierView {
  id: string;
  name: string;
}

export interface TicketLineView {
  id: string;
  orderLineId: string;
  itemId: string;
  itemName: string;
  variantName: string | null;
  quantity: number;
  seatNumber: number | null;
  modifiers: TicketLineModifierView[];
  addOnBatch: number;
  voided: boolean;
}

export interface TicketView {
  id: string;
  orderId: string;
  stationId: string | null;
  stationName: string | null;
  tableLabel: string | null;
  tokenNumber: number | null;
  status: "queued" | "bumped";
  firedAt: string;
  bumpedAt: string | null;
  recallCount: number;
  recalled: boolean;
  lines: TicketLineView[];
}

/** GET /kitchen/v1/outlets/:outletId/stations - the station-picker list. */
export function listStations(outletId: string): Promise<StationView[]> {
  return kdsApi<StationView[]>(`outlets/${encodeURIComponent(outletId)}/stations`);
}

/**
 * GET /kitchen/v1/outlets/:outletId/stations/:stationId/queue - queued
 * tickets oldest-first. `stationId` accepts a real station id or the
 * literal string "unrouted" (the synthetic no-station grouping, only
 * reachable when the outlet has zero stations).
 */
export function stationQueue(outletId: string, stationId: string): Promise<TicketView[]> {
  return kdsApi<TicketView[]>(`outlets/${encodeURIComponent(outletId)}/stations/${encodeURIComponent(stationId)}/queue`);
}

/** One item's live production count across all open (queued) tickets - server-aggregated from real ticket lines, never fabricated (SPEC CAP-5). */
export interface AllDaySummaryEntryView {
  itemId: string;
  itemName: string;
  quantity: number;
}

/** GET /kitchen/v1/outlets/:outletId/all-day-summary - server-computed per-item counts from queued ticket lines, alphabetical by item name (K4 sorts client-side). */
export function allDaySummary(outletId: string): Promise<AllDaySummaryEntryView[]> {
  return kdsApi<AllDaySummaryEntryView[]>(`outlets/${encodeURIComponent(outletId)}/all-day-summary`);
}

export function bumpTicket(ticketId: string): Promise<TicketView> {
  return kdsApi<TicketView>(`tickets/${encodeURIComponent(ticketId)}/bump`, { method: "POST" });
}

export function recallTicket(ticketId: string): Promise<TicketView> {
  return kdsApi<TicketView>(`tickets/${encodeURIComponent(ticketId)}/recall`, { method: "POST" });
}

export function refireTicket(ticketId: string): Promise<TicketView> {
  return kdsApi<TicketView>(`tickets/${encodeURIComponent(ticketId)}/refire`, { method: "POST" });
}
