import { describe, expect, it } from "vitest";
import {
  EMPTY_ADD_STAFF_FORM,
  ROLE_PERMISSION_CATALOG,
  roleHasPermission,
  staffFullName,
  validateAddStaffForm,
  type RoleView,
} from "./staff-state";

const ROLES: RoleView[] = [
  { id: "r-owner", name: "Owner", isSystem: true },
  { id: "r-manager", name: "Manager", isSystem: true },
  { id: "r-cashier", name: "Cashier", isSystem: true },
  { id: "r-waiter", name: "Waiter", isSystem: true },
  { id: "r-kitchen", name: "Kitchen", isSystem: true },
  { id: "r-accountant", name: "Accountant", isSystem: true },
];

describe("staffFullName", () => {
  it("returns the staff member's name", () => {
    expect(staffFullName({ name: "Priya Nair" })).toBe("Priya Nair");
  });
});

describe("validateAddStaffForm", () => {
  it("requires first name, last name, email and a role", () => {
    const errors = validateAddStaffForm(EMPTY_ADD_STAFF_FORM, ROLES);
    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.roleId).toBeTruthy();
  });

  it("rejects a malformed email", () => {
    const errors = validateAddStaffForm({ firstName: "Priya", lastName: "Nair", email: "not-an-email", roleId: "r-cashier" }, ROLES);
    expect(errors.email).toBeTruthy();
  });

  it("rejects a roleId that isn't one of the tenant's seeded roles - no free-text roles", () => {
    const errors = validateAddStaffForm({ firstName: "Priya", lastName: "Nair", email: "priya@example.com", roleId: "made-up-role" }, ROLES);
    expect(errors.roleId).toBeTruthy();
  });

  it("passes for a complete form with a real role id", () => {
    const errors = validateAddStaffForm({ firstName: "Priya", lastName: "Nair", email: "priya@example.com", roleId: "r-cashier" }, ROLES);
    expect(errors).toEqual({});
  });
});

describe("roleHasPermission", () => {
  it("grants Owner every catalogued permission", () => {
    for (const permission of ROLE_PERMISSION_CATALOG) {
      expect(roleHasPermission("Owner", permission.key)).toBe(true);
    }
  });

  it("denies Kitchen permissions it doesn't have, like refunds", () => {
    expect(roleHasPermission("Kitchen", "fire_kitchen")).toBe(true);
    expect(roleHasPermission("Kitchen", "refunds")).toBe(false);
  });

  it("denies everything for an unknown role name", () => {
    expect(roleHasPermission("Made Up Role", "take_orders")).toBe(false);
  });
});
