// Pure Staff & Roles logic (CAP-7), kept free of React so form validation and
// the permission-matrix lookup are unit-testable without a DOM - mirrors
// menu-state.ts/floor-plan-state.ts's split between logic and UI.
//
// restiq-backend's CAP-7 API (issue AusPosRest/restiq-backend#38) had not
// been started at implementation time - no branch, no Prisma model beyond
// `Role` (id/tenantId/name/isSystem, no permission metadata), no PIN or
// staff-user table on dev. The shapes below are this story's best-effort
// provisional contract, built from what does exist (Role's actual columns,
// checklist.service.ts's `staffAt` step, restiq-backend's SYSTEM_ROLES
// constant in tenants.service.ts) rather than invented from nothing; api.ts's
// header carries the same note. Reconcile against the real DTOs once
// restiq-backend#38 lands, same as CAP-4/5/6/10 reconciled against their
// backends here.
//
// Because Role carries no permission list, the "role permission matrix"
// (EXPERIENCE.md T7 pattern: read-only reference, roles are seeded not
// editable) can't be sourced from GET /admin/v1/roles - it's rendered from
// the static SYSTEM_ROLE_PERMISSIONS reference below instead, matching the
// render's intent (T7 shows Cashier's effective POS permissions as a fixed
// checklist). This is a deliberate deviation, flagged in the PR.

export interface RoleView {
  id: string;
  name: string;
  isSystem: boolean;
}

export type PinStatus = "active" | "none";

export interface StaffView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  roleName: string;
  pinStatus: PinStatus;
}

export function staffFullName(staff: Pick<StaffView, "firstName" | "lastName">): string {
  return `${staff.firstName} ${staff.lastName}`.trim();
}

// --- Add-staff form ---

export interface AddStaffForm {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
}

export const EMPTY_ADD_STAFF_FORM: AddStaffForm = { firstName: "", lastName: "", email: "", roleId: "" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AddStaffErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
}

/**
 * `roles` is always the tenant's actual seeded set (fetched from
 * GET /admin/v1/roles) - validating roleId against it, rather than a
 * hardcoded name list, is what keeps this a closed set with no free-text
 * escape hatch (SPEC CAP-7 success criterion) even if the seeded names ever
 * change.
 */
export function validateAddStaffForm(form: AddStaffForm, roles: readonly RoleView[]): AddStaffErrors {
  const errors: AddStaffErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.roleId || !roles.some((role) => role.id === form.roleId)) errors.roleId = "Choose one of the six system roles.";
  return errors;
}

// --- Role permission matrix (static reference - see file header) ---

export interface RolePermission {
  key: string;
  label: string;
}

export const ROLE_PERMISSION_CATALOG: readonly RolePermission[] = [
  { key: "take_orders", label: "Take orders" },
  { key: "fire_kitchen", label: "Fire to kitchen" },
  { key: "settle_bills", label: "Settle bills" },
  { key: "discounts", label: "Apply discounts" },
  { key: "void_after_fire", label: "Void after fire" },
  { key: "refunds", label: "Issue refunds" },
  { key: "z_report", label: "Run Z-report" },
  { key: "manage_menu", label: "Manage menu" },
  { key: "manage_staff", label: "Manage staff & roles" },
];

/** System-role name -> the permission keys that role can do. Every key not listed here is implicitly denied for that role. */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  Owner: ROLE_PERMISSION_CATALOG.map((p) => p.key),
  Manager: ["take_orders", "fire_kitchen", "settle_bills", "discounts", "void_after_fire", "refunds", "z_report", "manage_menu", "manage_staff"],
  Cashier: ["take_orders", "fire_kitchen", "settle_bills", "discounts"],
  Waiter: ["take_orders", "fire_kitchen"],
  Kitchen: ["fire_kitchen"],
  Accountant: ["settle_bills", "z_report"],
};

export function roleHasPermission(roleName: string, permissionKey: string): boolean {
  return SYSTEM_ROLE_PERMISSIONS[roleName]?.includes(permissionKey) ?? false;
}
