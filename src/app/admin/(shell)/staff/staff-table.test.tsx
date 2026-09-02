import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoleView, StaffView } from "./staff-state";
import { StaffTable } from "./staff-table";

const ROLES: RoleView[] = [
  { id: "r-owner", name: "Owner", isSystem: true },
  { id: "r-manager", name: "Manager", isSystem: true },
  { id: "r-cashier", name: "Cashier", isSystem: true },
  { id: "r-waiter", name: "Waiter", isSystem: true },
  { id: "r-kitchen", name: "Kitchen", isSystem: true },
  { id: "r-accountant", name: "Accountant", isSystem: true },
];

const STAFF: StaffView[] = [
  { id: "s1", name: "Priya Nair", email: "priya@example.com", roleId: "r-cashier", roleName: "Cashier", pinStatus: "active" },
  { id: "s2", name: "Arjun Rao", email: "arjun@example.com", roleId: "r-waiter", roleName: "Waiter", pinStatus: "none" },
];

function noop() {}

afterEach(() => cleanup());

describe("StaffTable", () => {
  it("renders a row per staff member with name, email, role and PIN status", () => {
    render(<StaffTable staff={STAFF} roles={ROLES} busyStaffId={null} issuedPin={null} onRoleSelected={noop} onIssuePin={noop} onRevokeRequested={noop} onDismissIssuedPin={noop} />);

    expect(screen.getByTestId("staff-row-s1").textContent).toContain("Priya Nair");
    expect(screen.getByTestId("staff-row-s1").textContent).toContain("priya@example.com");
    expect((screen.getByTestId("staff-role-select-s1") as HTMLSelectElement).value).toBe("r-cashier");
    expect(screen.getByTestId("staff-pin-status-s1").textContent).toBe("Active");
    expect(screen.getByTestId("staff-pin-status-s2").textContent).toBe("No PIN");
  });

  it("shows an empty state with no staff rows", () => {
    render(<StaffTable staff={[]} roles={ROLES} busyStaffId={null} issuedPin={null} onRoleSelected={noop} onIssuePin={noop} onRevokeRequested={noop} onDismissIssuedPin={noop} />);
    expect(screen.getByTestId("staff-empty")).toBeTruthy();
    expect(screen.queryByTestId("staff-table")).toBeNull();
  });

  it("the role dropdown only ever offers the six seeded system roles - no free text", () => {
    render(<StaffTable staff={STAFF} roles={ROLES} busyStaffId={null} issuedPin={null} onRoleSelected={noop} onIssuePin={noop} onRevokeRequested={noop} onDismissIssuedPin={noop} />);
    const select = screen.getByTestId("staff-role-select-s1") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(ROLES.map((r) => r.id));
  });

  it("requests a role change with the selected role id, without applying it locally", async () => {
    const onRoleSelected = vi.fn();
    render(<StaffTable staff={STAFF} roles={ROLES} busyStaffId={null} issuedPin={null} onRoleSelected={onRoleSelected} onIssuePin={noop} onRevokeRequested={noop} onDismissIssuedPin={noop} />);

    await userEvent.selectOptions(screen.getByTestId("staff-role-select-s1"), "r-manager");
    expect(onRoleSelected).toHaveBeenCalledWith("s1", "r-manager");
  });

  it("shows Issue PIN for a staff member with no PIN, and Revoke access for one with an active PIN", async () => {
    const onIssuePin = vi.fn();
    const onRevokeRequested = vi.fn();
    render(<StaffTable staff={STAFF} roles={ROLES} busyStaffId={null} issuedPin={null} onRoleSelected={noop} onIssuePin={onIssuePin} onRevokeRequested={onRevokeRequested} onDismissIssuedPin={noop} />);

    expect(screen.queryByTestId("staff-issue-pin-s1")).toBeNull();
    await userEvent.click(screen.getByTestId("staff-revoke-pin-s1"));
    expect(onRevokeRequested).toHaveBeenCalledWith("s1");

    expect(screen.queryByTestId("staff-revoke-pin-s2")).toBeNull();
    await userEvent.click(screen.getByTestId("staff-issue-pin-s2"));
    expect(onIssuePin).toHaveBeenCalledWith("s2");
  });

  it("disables the busy row's controls", () => {
    render(<StaffTable staff={STAFF} roles={ROLES} busyStaffId="s1" issuedPin={null} onRoleSelected={noop} onIssuePin={noop} onRevokeRequested={noop} onDismissIssuedPin={noop} />);
    expect(screen.getByTestId("staff-role-select-s1")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("staff-revoke-pin-s1")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("staff-issue-pin-s2")).toHaveProperty("disabled", false);
  });

  it("shows the issued-PIN chip under the matching row, and dismissing it calls back", async () => {
    const onDismissIssuedPin = vi.fn();
    render(
      <StaffTable
        staff={STAFF}
        roles={ROLES}
        busyStaffId={null}
        issuedPin={{ staffId: "s2", name: "Arjun Rao", pin: "4821" }}
        onRoleSelected={noop}
        onIssuePin={noop}
        onRevokeRequested={noop}
        onDismissIssuedPin={onDismissIssuedPin}
      />,
    );

    expect(screen.queryByTestId("staff-pin-issued-row-s1")).toBeNull();
    expect(screen.getByTestId("staff-pin-issued-row-s2")).toBeTruthy();
    expect(screen.getByTestId("staff-pin-chip-value").textContent).toBe("4821");

    await userEvent.click(screen.getByTestId("staff-pin-chip-dismiss"));
    expect(onDismissIssuedPin).toHaveBeenCalledOnce();
  });
});
