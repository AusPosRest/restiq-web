// Typed client-side access to the backend API via the /admin/api pass-through.
import type { ChecklistState } from "./checklist-state";
import type { MenuImportDraft, MenuImportEditableField } from "./menu-import-state";
import type {
  AllergenView,
  CategoryView,
  ComboView,
  CurrentPriceView,
  ItemView,
  ModifierGroupView,
  OutletView,
  PriceChannel,
} from "./(shell)/menu/menu-state";
import type { BrandingTokens } from "./(shell)/settings/branding-state";
import type { OutletCapabilityView } from "./(shell)/settings/capability-state";
import type { DiningTableView, FloorPlanView, FloorView, PrinterRenderMode, PrinterView, StationView } from "./(shell)/floor-plan/floor-plan-state";
import type { AdminDeviceView, DeviceType, EnrolmentCodeResult } from "./(shell)/devices/devices-state";
import type { RoleView, StaffView } from "./(shell)/staff/staff-state";

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

// --- CAP-4 Menu Management. Verified against restiq-backend's actual
// admin/v1/menu working tree (feature/30-menu-management, read directly -
// src/admin/menu/*.controller.ts/*.dtos.ts - not a summarized contract).
// Notably: modifier groups and allergens are tenant-wide catalogs an item
// only references by id; a price is written and read per (item, variant?,
// channel, outlet?) - there is no bulk "menu with prices" or "list an item's
// scheduled prices" endpoint, so this client fetches price per line and
// tracks a just-scheduled change locally (see menu-state.ts's file header
// and PendingPriceInfo) rather than pretending the backend can list it. There
// is also no outlets-listing endpoint anywhere in the admin realm yet (not
// just this story) - fetchOutlets calls the path CAP-10 lands it at
// (`GET /admin/v1/outlets`, verified directly against
// src/admin/outlets/outlets.controller.ts on feature/32-branding-
// capabilities); the outlet switcher and per-outlet features degrade to "no
// outlets" until that story merges.

export function fetchOutlets(): Promise<OutletView[]> {
  return adminApi<OutletView[]>("outlets");
}

export function fetchCategories(): Promise<CategoryView[]> {
  return adminApi<CategoryView[]>("menu/categories");
}

export function createMenuCategory(name: string): Promise<CategoryView> {
  return adminApi<CategoryView>("menu/categories", { method: "POST", body: JSON.stringify({ name }) });
}

export function fetchItems(categoryId?: string): Promise<ItemView[]> {
  return adminApi<ItemView[]>(categoryId ? `menu/items?categoryId=${encodeURIComponent(categoryId)}` : "menu/items");
}

export interface CreateItemInput {
  categoryId: string;
  name: string;
  shortName: string;
  variants?: Array<{ name: string; sortOrder?: number }>;
  modifierGroupIds?: string[];
  allergenIds?: string[];
}

export function createMenuItem(input: CreateItemInput): Promise<ItemView> {
  return adminApi<ItemView>("menu/items", { method: "POST", body: JSON.stringify(input) });
}

export interface UpdateItemInput {
  name?: string;
  shortName?: string;
  categoryId?: string;
}

export function updateMenuItem(itemId: string, input: UpdateItemInput): Promise<ItemView> {
  return adminApi<ItemView>(`menu/items/${itemId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function setItemAvailability(itemId: string, available: boolean): Promise<ItemView> {
  return adminApi<ItemView>(`menu/items/${itemId}/availability`, { method: "PATCH", body: JSON.stringify({ available }) });
}

export function addVariant(itemId: string, name: string): Promise<ItemView> {
  return adminApi<ItemView>(`menu/items/${itemId}/variants`, { method: "POST", body: JSON.stringify({ name }) });
}

export function removeVariant(itemId: string, variantId: string): Promise<ItemView> {
  return adminApi<ItemView>(`menu/items/${itemId}/variants/${variantId}`, { method: "DELETE" });
}

export function replaceItemModifierGroups(itemId: string, modifierGroupIds: string[]): Promise<ItemView> {
  return adminApi<ItemView>(`menu/items/${itemId}/modifier-groups`, { method: "PUT", body: JSON.stringify({ modifierGroupIds }) });
}

export function replaceItemAllergens(itemId: string, allergenIds: string[]): Promise<ItemView> {
  return adminApi<ItemView>(`menu/items/${itemId}/allergens`, { method: "PUT", body: JSON.stringify({ allergenIds }) });
}

export function setOutletAvailability(itemId: string, outletId: string, available: boolean): Promise<{ itemId: string; outletId: string; available: boolean }> {
  return adminApi(`menu/items/${itemId}/outlets/${outletId}/availability`, { method: "PUT", body: JSON.stringify({ available }) });
}

export function clearOutletAvailability(itemId: string, outletId: string): Promise<void> {
  return adminApi<void>(`menu/items/${itemId}/outlets/${outletId}/availability`, { method: "DELETE" });
}

export interface CreatePriceInput {
  variantId?: string;
  channel: PriceChannel;
  outletId?: string;
  priceMinor: number;
  currency: string;
  effectiveAt?: string;
  reason: string;
}

export interface ItemPriceView extends CurrentPriceView {
  id: string;
  createdAt: string;
}

export function createItemPrice(itemId: string, input: CreatePriceInput): Promise<ItemPriceView> {
  return adminApi<ItemPriceView>(`menu/items/${itemId}/prices`, { method: "POST", body: JSON.stringify(input) });
}

export function fetchCurrentPrice(
  itemId: string,
  params: { channel: PriceChannel; variantId?: string; outletId?: string },
): Promise<CurrentPriceView> {
  const search = new URLSearchParams({ channel: params.channel });
  if (params.variantId) search.set("variantId", params.variantId);
  if (params.outletId) search.set("outletId", params.outletId);
  return adminApi<CurrentPriceView>(`menu/items/${itemId}/price?${search.toString()}`).catch((error: unknown) => {
    // 404 (no_current_price) means this line has never been priced yet -
    // that's a normal state for a freshly added variant, not a load failure.
    if (error instanceof AdminApiError && error.status === 404) return null as unknown as CurrentPriceView;
    throw error;
  });
}

export function fetchModifierGroups(): Promise<ModifierGroupView[]> {
  return adminApi<ModifierGroupView[]>("menu/modifier-groups");
}

export interface CreateModifierGroupInput {
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers?: Array<{ name: string; priceMinor?: number }>;
}

export function createModifierGroup(input: CreateModifierGroupInput): Promise<ModifierGroupView> {
  return adminApi<ModifierGroupView>("menu/modifier-groups", { method: "POST", body: JSON.stringify(input) });
}

export function addModifier(groupId: string, name: string, priceMinor: number): Promise<ModifierGroupView> {
  return adminApi<ModifierGroupView>(`menu/modifier-groups/${groupId}/modifiers`, { method: "POST", body: JSON.stringify({ name, priceMinor }) });
}

export function fetchAllergens(): Promise<AllergenView[]> {
  return adminApi<AllergenView[]>("menu/allergens");
}

export function createAllergen(name: string): Promise<AllergenView> {
  return adminApi<AllergenView>("menu/allergens", { method: "POST", body: JSON.stringify({ name }) });
}

export function fetchCombos(): Promise<ComboView[]> {
  return adminApi<ComboView[]>("menu/combos");
}

export interface CreateComboInput {
  name: string;
  categoryId?: string;
  priceMinor: number;
  currency: string;
  components: Array<{ itemId: string; quantity?: number }>;
}

export function createCombo(input: CreateComboInput): Promise<ComboView> {
  return adminApi<ComboView>("menu/combos", { method: "POST", body: JSON.stringify(input) });
}

// --- CAP-10 Branding & capabilities. Verified against restiq-backend's
// actual admin/v1/branding and admin/v1/outlets working tree
// (feature/32-branding-capabilities, read directly - not a summarized
// contract, same discipline as CAP-3/CAP-4). Notably: branding.dtos.ts's
// BrandingView is a *flat* token set (primaryColor/secondaryColor/
// accentColor/surfaceColor/font/cornerRadiusPx/logoUrl/receiptHeader/
// receiptFooter), not the `{ colors: {...} }` nesting assumed before that
// code existed, and PUT merges whatever fields are sent into the tenant's
// existing branding_tokens JSON rather than replacing it wholesale - see
// branding-state.ts's file header. Outlet capabilities live in a new,
// outlet-scoped `outlet_capabilities` table (distinct from the pre-existing,
// tenant-wide `TenantCapability`) and only ever return rows that have been
// explicitly toggled - see capability-state.ts's mergeCapabilities for how
// the UI fills in the rest as disabled-by-default.

// GET is read via useAdminLoad("branding") directly (that hook exists
// precisely for this GET-and-render shape and had no caller yet).

export function saveBranding(tokens: BrandingTokens): Promise<BrandingTokens> {
  return adminApi<BrandingTokens>("branding", { method: "PUT", body: JSON.stringify(tokens) });
}

export function fetchOutletCapabilities(outletId: string): Promise<OutletCapabilityView[]> {
  return adminApi<OutletCapabilityView[]>(`outlets/${outletId}/capabilities`);
}

export function setOutletCapability(outletId: string, key: string, enabled: boolean): Promise<OutletCapabilityView> {
  return adminApi<OutletCapabilityView>(`outlets/${outletId}/capabilities/${key}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

// --- CAP-5 Floor plan & stations. Verified against restiq-backend's actual
// admin/v1/floor-plan working tree (feature/34-floor-plan,
// src/admin/floor-plan/floor-plan.controller.ts / .dtos.ts, read directly -
// not a summarized contract, same discipline as CAP-4/CAP-10). Notably: the
// single GET returns floors, stations AND printers together in one payload
// (no separate stations/printers list endpoints exist) with each floor
// carrying its own tables nested - fetchFloorPlan flattens that into the
// {floors, tables, stations, printers} shape floor-plan-state.ts's UI
// components want, so a table move only ever needs to look up one flat
// array by id. See floor-plan-state.ts's file header for the overlap-policy
// (reject, not auto-adjust) and no-printer-acknowledgement facts this
// contract carries.

interface FloorPlanApiFloor extends FloorView {
  tables: DiningTableView[];
}

interface FloorPlanApiResponse {
  floors: FloorPlanApiFloor[];
  stations: StationView[];
  printers: PrinterView[];
}

export async function fetchFloorPlan(outletId: string): Promise<FloorPlanView> {
  const data = await adminApi<FloorPlanApiResponse>(`outlets/${outletId}/floor-plan`);
  return {
    floors: data.floors.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
    tables: data.floors.flatMap((floor) => floor.tables),
    stations: data.stations,
    printers: data.printers,
  };
}

export interface UpdateTableInput {
  x?: number;
  y?: number;
  seatCapacity?: number;
}

export function updateTable(outletId: string, tableId: string, input: UpdateTableInput): Promise<DiningTableView> {
  return adminApi<DiningTableView>(`outlets/${outletId}/tables/${tableId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface UpdateStationInput {
  ageingThresholdMinutes?: number;
  primaryPrinterId?: string | null;
  fallbackPrinterId?: string | null;
  /** Required (true) whenever this request would leave primaryPrinterId null - the backend's own printer_required rule, see floor-plan-state.ts. */
  noPrinterAcknowledged?: boolean;
}

export function updateStation(outletId: string, stationId: string, input: UpdateStationInput): Promise<StationView> {
  return adminApi<StationView>(`outlets/${outletId}/stations/${stationId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function updatePrinter(outletId: string, printerId: string, renderMode: PrinterRenderMode): Promise<PrinterView> {
  return adminApi<PrinterView>(`outlets/${outletId}/floor-plan/printers/${printerId}`, {
    method: "PATCH",
    body: JSON.stringify({ renderMode }),
  });
}

// --- CAP-6 Devices & printers. Verified against restiq-backend's actual
// admin/v1/outlets/:outletId/devices working tree (feature/36-tenant-
// devices, src/admin/devices/devices.controller.ts, read directly - not a
// summarized contract, same discipline as CAP-4/CAP-5/CAP-10). Per AD-12,
// AdminDevicesService is a thin tenant-forced wrapper around the same
// DevicesService Platform Console's device fleet uses - GET returns the same
// {devices, nextCursor, total} shape ops's fleet view does (devices-state.ts
// documents the appVersion/lastContactAt gap in that shared response
// mapping); POST enrolment-codes takes only {deviceType} since tenantId and
// outletId come from the owner's session and the URL, never the body.
// updatePrinter reuses CAP-5's floor-plan module (PATCH .../floor-plan/
// printers/:printerId, {renderMode}) - printer render-mode isn't part of
// CAP-6's own backend surface.

export function fetchDevices(outletId: string): Promise<AdminDeviceView[]> {
  return adminApi<{ devices: AdminDeviceView[] }>(`outlets/${outletId}/devices`).then((res) => res.devices);
}

export function generateEnrolmentCode(outletId: string, deviceType: DeviceType): Promise<EnrolmentCodeResult> {
  return adminApi<EnrolmentCodeResult>(`outlets/${outletId}/devices/enrolment-codes`, {
    method: "POST",
    body: JSON.stringify({ deviceType }),
  });
}

// --- CAP-7 Staff & roles. UNVERIFIED against restiq-backend: issue
// AusPosRest/restiq-backend#38 was still open with no branch and no staff/PIN
// Prisma model at implementation time (only `Role` - id/tenantId/name/
// isSystem - existed, seeded from tenants.service.ts's SYSTEM_ROLES). These
// paths and shapes are this story's provisional contract, following the
// admin realm's existing REST conventions (plural resource, nested action
// segment, PATCH for partial update) - reconcile against the real DTOs once
// #38 lands, same as every other CAP module's header note in this file.

export function fetchRoles(): Promise<RoleView[]> {
  return adminApi<RoleView[]>("roles");
}

export function fetchStaff(): Promise<StaffView[]> {
  return adminApi<StaffView[]>("staff");
}

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
}

export function createStaff(input: CreateStaffInput): Promise<StaffView> {
  return adminApi<StaffView>("staff", { method: "POST", body: JSON.stringify(input) });
}

// Role change is security-relevant (SPEC constraints: audited with actor +
// reason, EXPERIENCE.md: pessimistic with a confirm step) - same reason
// requirement as a price change.
export function updateStaffRole(staffId: string, roleId: string, reason: string): Promise<StaffView> {
  return adminApi<StaffView>(`staff/${staffId}/role`, { method: "PATCH", body: JSON.stringify({ roleId, reason }) });
}

export interface IssuedPin {
  pin: string;
  issuedAt: string;
}

export function issueStaffPin(staffId: string): Promise<IssuedPin> {
  return adminApi<IssuedPin>(`staff/${staffId}/pin`, { method: "POST" });
}

// PIN revoke is security-relevant (SPEC constraints; EXPERIENCE.md: confirm-
// modal-with-plain-language-consequence) - carries the same audit reason.
export function revokeStaffPin(staffId: string, reason: string): Promise<StaffView> {
  return adminApi<StaffView>(`staff/${staffId}/pin`, { method: "DELETE", body: JSON.stringify({ reason }) });
}
