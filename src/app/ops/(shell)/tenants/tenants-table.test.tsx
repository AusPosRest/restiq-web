// The five mandatory data-view states (EXPERIENCE.md) on the O3 DataTable.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantListItem } from "../api";
import { TenantsTable } from "./tenants-table";

const replace = vi.fn();
const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/ops/tenants",
  useSearchParams: () => new URLSearchParams(search),
}));

function tenant(overrides: Partial<TenantListItem>): TenantListItem {
  return {
    id: "0192aaaa-0000-7000-8000-000000000001",
    name: "Bombay Bistro Group",
    country: "IN",
    status: "provisioning",
    plan: "standard",
    outletCount: 2,
    health: "unknown",
    createdAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

function listResponse(tenants: TenantListItem[]): Response {
  return new Response(JSON.stringify({ tenants, nextCursor: null, total: tenants.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("TenantsTable", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    search = "";
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows skeleton rows while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<TenantsTable />);
    expect(screen.getByTestId("tenants-loading")).toBeTruthy();
  });

  it("renders rows and opens detail on row click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([tenant({})])));
    render(<TenantsTable />);
    const row = await screen.findByTestId("tenants-row-0192aaaa-0000-7000-8000-000000000001");
    expect(row.textContent).toContain("Bombay Bistro Group");
    await userEvent.click(row);
    expect(push).toHaveBeenCalledWith("/ops/tenants/0192aaaa-0000-7000-8000-000000000001");
  });

  it("shows the true-empty state with a New tenant CTA when nothing exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([])));
    render(<TenantsTable />);
    expect(await screen.findByTestId("tenants-empty")).toBeTruthy();
    expect(screen.getByTestId("tenants-empty-new")).toBeTruthy();
    expect(screen.queryByTestId("tenants-filtered-empty")).toBeNull();
  });

  it("shows the filtered-empty state with clear-filters when filters hide everything", async () => {
    search = "status=active";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([])));
    render(<TenantsTable />);
    expect(await screen.findByTestId("tenants-filtered-empty")).toBeTruthy();
    expect(screen.queryByTestId("tenants-empty")).toBeNull();
    await userEvent.click(screen.getByTestId("tenants-filtered-empty-clear"));
    expect(replace).toHaveBeenCalledWith("/ops/tenants");
  });

  it("shows the inline load-error panel and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValue(listResponse([tenant({})]));
    vi.stubGlobal("fetch", fetchMock);
    render(<TenantsTable />);
    const panel = await screen.findByTestId("tenants-error");
    expect(panel).toBeTruthy();
    await userEvent.click(screen.getByTestId("tenants-error-retry"));
    await waitFor(() => expect(screen.queryByTestId("tenants-error")).toBeNull());
    expect(await screen.findByTestId("tenants-table")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mirrors filter changes into the URL and removes chips per filter", async () => {
    search = "status=active&country=IN";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([tenant({ status: "active" })])));
    render(<TenantsTable />);
    const chips = await screen.findByTestId("tenants-filter-chips");
    expect(chips.textContent).toContain("Status: active");
    expect(chips.textContent).toContain("Country: IN");

    await userEvent.click(screen.getByTestId("tenants-chip-remove-country"));
    expect(replace).toHaveBeenCalledWith("/ops/tenants?status=active");

    await userEvent.selectOptions(screen.getByTestId("tenants-filter-plan"), "enterprise");
    expect(replace).toHaveBeenCalledWith("/ops/tenants?status=active&country=IN&plan=enterprise");
  });

  it("puts sort state in the URL when a header is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([tenant({})])));
    render(<TenantsTable />);
    await screen.findByTestId("tenants-table");
    await userEvent.click(screen.getByTestId("tenants-sort-name"));
    expect(replace).toHaveBeenCalledWith("/ops/tenants?sort=name");
  });
});
