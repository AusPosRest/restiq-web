import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { Staff } from "./staff";
import type { StaffView } from "./staff-state";

const ROLES = [
  { id: "r-owner", name: "Owner", isSystem: true },
  { id: "r-manager", name: "Manager", isSystem: true },
  { id: "r-cashier", name: "Cashier", isSystem: true },
  { id: "r-waiter", name: "Waiter", isSystem: true },
  { id: "r-kitchen", name: "Kitchen", isSystem: true },
  { id: "r-accountant", name: "Accountant", isSystem: true },
];

const STAFF: StaffView[] = [
  { id: "s1", name: "Priya Nair", email: "priya@example.com", roleId: "r-cashier", roleName: "Cashier", pinStatus: "active" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(overrides: { staff?: StaffView[]; onPatchRole?: (body: unknown) => unknown; onDeletePin?: (body: unknown) => unknown } = {}) {
  const staff = overrides.staff ?? STAFF;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/admin/api/roles") && method === "GET") return Promise.resolve(jsonResponse(ROLES));
    if (url.includes("/admin/api/staff") && method === "GET") return Promise.resolve(jsonResponse({ staff }));
    if (url.endsWith("/admin/api/staff") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { name: string; email: string; roleId: string };
      const role = ROLES.find((r) => r.id === body.roleId);
      return Promise.resolve(jsonResponse({ id: "s2", ...body, roleName: role?.name ?? "", pinStatus: "none" }));
    }
    if (url.includes("/staff/s1") && method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      const result = overrides.onPatchRole ? overrides.onPatchRole(body) : { ...staff[0], roleId: body.roleId, roleName: ROLES.find((r) => r.id === body.roleId)?.name };
      return Promise.resolve(jsonResponse(result));
    }
    if (url.includes("/staff/s1/revoke-pin") && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const result = overrides.onDeletePin ? overrides.onDeletePin(body) : { ...staff[0], pinStatus: "revoked" };
      return Promise.resolve(jsonResponse(result));
    }
    if (url.includes("/staff/s1/pin") && method === "POST") {
      return Promise.resolve(jsonResponse({ pin: "4821" }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderStaff() {
  return render(
    <ToastProvider>
      <Staff />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Staff", () => {
  it("shows a loading skeleton, then the staff list", async () => {
    stubFetch();
    renderStaff();
    expect(screen.getByTestId("staff-loading")).toBeTruthy();

    expect(await screen.findByTestId("staff-row-s1")).toBeTruthy();
    expect(screen.getByTestId("permission-matrix")).toBeTruthy();
  });

  it("shows a retryable error panel when loading fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500)));
    vi.stubGlobal("fetch", fetchMock);
    renderStaff();

    await screen.findByTestId("staff-load-error");
    await userEvent.click(screen.getByTestId("staff-load-error-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("adds a staff member through the Add staff dialog", async () => {
    stubFetch();
    renderStaff();
    await screen.findByTestId("staff-row-s1");

    await userEvent.click(screen.getByTestId("staff-add-open"));
    await userEvent.type(screen.getByTestId("add-staff-first-name"), "Arjun");
    await userEvent.type(screen.getByTestId("add-staff-last-name"), "Rao");
    await userEvent.type(screen.getByTestId("add-staff-email"), "arjun@example.com");
    await userEvent.selectOptions(screen.getByTestId("add-staff-role"), "r-waiter");
    await userEvent.click(screen.getByTestId("add-staff-submit"));

    expect(await screen.findByTestId("staff-row-s2")).toBeTruthy();
    expect((await screen.findByTestId("toast-success")).textContent).toContain("Arjun Rao was added.");
  });

  it("changing a row's role opens a confirm dialog and persists on confirm", async () => {
    stubFetch();
    renderStaff();
    await screen.findByTestId("staff-row-s1");

    await userEvent.selectOptions(screen.getByTestId("staff-role-select-s1"), "r-manager");
    const dialog = await screen.findByTestId("confirm-reason-dialog");
    expect(within(dialog).getByText(/Priya Nair/)).toBeTruthy();

    await userEvent.type(screen.getByTestId("confirm-reason"), "Promoted to manager");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(screen.queryByTestId("confirm-reason-dialog")).toBeNull());
    expect((screen.getByTestId("staff-role-select-s1") as HTMLSelectElement).value).toBe("r-manager");
    expect((await screen.findByTestId("toast-success")).textContent).toContain("Manager");
  });

  it("revoking a PIN shows a plain-language confirm naming the person, and applies on confirm", async () => {
    stubFetch();
    renderStaff();
    await screen.findByTestId("staff-row-s1");

    await userEvent.click(screen.getByTestId("staff-revoke-pin-s1"));
    const dialog = await screen.findByTestId("confirm-reason-dialog");
    expect(within(dialog).getByText(/This removes Priya Nair's access to the till\./)).toBeTruthy();

    await userEvent.type(screen.getByTestId("confirm-reason"), "Left the company");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(screen.getByTestId("staff-pin-status-s1").textContent).toBe("Revoked"));
    expect(screen.getByTestId("staff-issue-pin-s1")).toBeTruthy();
  });

  it("cancelling the revoke dialog leaves the PIN active", async () => {
    stubFetch();
    renderStaff();
    await screen.findByTestId("staff-row-s1");

    await userEvent.click(screen.getByTestId("staff-revoke-pin-s1"));
    await screen.findByTestId("confirm-reason-dialog");
    await userEvent.click(screen.getByTestId("confirm-cancel"));

    expect(screen.queryByTestId("confirm-reason-dialog")).toBeNull();
    expect(screen.getByTestId("staff-pin-status-s1").textContent).toBe("Active");
  });
});
