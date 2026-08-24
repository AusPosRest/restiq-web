import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoleView } from "./staff-state";
import { PermissionMatrix } from "./permission-matrix";

const ROLES: RoleView[] = [
  { id: "r-owner", name: "Owner", isSystem: true },
  { id: "r-cashier", name: "Cashier", isSystem: true },
  { id: "r-kitchen", name: "Kitchen", isSystem: true },
];

afterEach(() => cleanup());

describe("PermissionMatrix", () => {
  it("renders a column per role and a row per permission", () => {
    render(<PermissionMatrix roles={ROLES} />);
    const table = screen.getByTestId("permission-matrix");
    expect(table.textContent).toContain("Owner");
    expect(table.textContent).toContain("Cashier");
    expect(table.textContent).toContain("Kitchen");
    expect(table.textContent).toContain("Take orders");
    expect(table.textContent).toContain("Issue refunds");
  });

  it("marks Kitchen as unable to issue refunds and Owner as able to", () => {
    render(<PermissionMatrix roles={ROLES} />);
    expect(screen.getByTestId("permission-cell-refunds-r-kitchen").textContent).toContain("Cannot");
    expect(screen.getByTestId("permission-cell-refunds-r-owner").textContent).toContain("Can");
  });
});
