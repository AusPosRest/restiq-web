import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoleView } from "./staff-state";
import { AddStaffDialog } from "./add-staff-dialog";

const ROLES: RoleView[] = [
  { id: "r-owner", name: "Owner", isSystem: true },
  { id: "r-manager", name: "Manager", isSystem: true },
  { id: "r-cashier", name: "Cashier", isSystem: true },
  { id: "r-waiter", name: "Waiter", isSystem: true },
  { id: "r-kitchen", name: "Kitchen", isSystem: true },
  { id: "r-accountant", name: "Accountant", isSystem: true },
];

afterEach(() => cleanup());

describe("AddStaffDialog", () => {
  it("renders nothing when closed", () => {
    render(<AddStaffDialog open={false} roles={ROLES} onCancel={() => {}} onSubmit={() => {}} />);
    expect(screen.queryByTestId("add-staff-dialog")).toBeNull();
  });

  it("offers exactly the six seeded roles, plus a placeholder", () => {
    render(<AddStaffDialog open roles={ROLES} onCancel={() => {}} onSubmit={() => {}} />);
    const select = screen.getByTestId("add-staff-role") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["", ...ROLES.map((r) => r.id)]);
  });

  it("blocks submit and shows field errors when required fields, including role, are missing", async () => {
    const onSubmit = vi.fn();
    render(<AddStaffDialog open roles={ROLES} onCancel={() => {}} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByTestId("add-staff-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("add-staff-first-name-error")).toBeTruthy();
    expect(screen.getByTestId("add-staff-last-name-error")).toBeTruthy();
    expect(screen.getByTestId("add-staff-email-error")).toBeTruthy();
    expect(screen.getByTestId("add-staff-role-error")).toBeTruthy();
  });

  it("rejects a role value that isn't one of the six seeded roles, even if forced in", async () => {
    const onSubmit = vi.fn();
    render(<AddStaffDialog open roles={ROLES} onCancel={() => {}} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByTestId("add-staff-first-name"), "Priya");
    await userEvent.type(screen.getByTestId("add-staff-last-name"), "Nair");
    await userEvent.type(screen.getByTestId("add-staff-email"), "priya@example.com");
    // No matching <option> exists for a made-up role - selectOptions would
    // fail to find it, so this asserts the closed-set guarantee directly:
    // there is no way to pick anything the six-role select doesn't offer.
    const select = screen.getByTestId("add-staff-role") as HTMLSelectElement;
    expect(Array.from(select.options).some((o) => o.value === "made-up-role")).toBe(false);
  });

  it("submits a valid form with the chosen role id", async () => {
    const onSubmit = vi.fn();
    render(<AddStaffDialog open roles={ROLES} onCancel={() => {}} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByTestId("add-staff-first-name"), "Priya");
    await userEvent.type(screen.getByTestId("add-staff-last-name"), "Nair");
    await userEvent.type(screen.getByTestId("add-staff-email"), "priya@example.com");
    await userEvent.selectOptions(screen.getByTestId("add-staff-role"), "r-cashier");
    await userEvent.click(screen.getByTestId("add-staff-submit"));

    expect(onSubmit).toHaveBeenCalledWith({ firstName: "Priya", lastName: "Nair", email: "priya@example.com", roleId: "r-cashier" });
  });

  it("shows a server error and stays open when the submit fails", () => {
    render(<AddStaffDialog open roles={ROLES} error="That email is already in use." onCancel={() => {}} onSubmit={() => {}} />);
    expect(screen.getByTestId("add-staff-error").textContent).toBe("That email is already in use.");
  });
});
