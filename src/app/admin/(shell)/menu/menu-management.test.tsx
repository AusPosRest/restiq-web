import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { MenuManagement } from "./menu-management";
import { ItemView } from "./menu-state";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function item(overrides: Partial<ItemView> = {}): ItemView {
  return {
    id: "item-1",
    name: "Paneer Tikka",
    shortName: "Paneer Tikka",
    categoryId: "tandoor",
    available: true,
    variants: [],
    modifierGroups: [],
    allergens: [],
    ...overrides,
  };
}

const ITEMS = [item({ id: "1", name: "Paneer Tikka", categoryId: "tandoor" }), item({ id: "2", name: "Dal Makhani", shortName: "Dal Makhani", categoryId: "mains" })];
const CATEGORIES = [
  { id: "tandoor", name: "Tandoor", sortOrder: 0, itemCount: 1 },
  { id: "mains", name: "Mains", sortOrder: 1, itemCount: 1 },
];

function stubFetch(overrides: { items?: unknown; fail?: boolean } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (overrides.fail) return Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500));
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/admin/api/menu/items") && url.includes("price?")) {
      return Promise.resolve(
        jsonResponse({ itemId: "1", variantId: null, channel: "dine_in", outletId: null, priceMinor: 18000, currency: "INR", effectiveAt: "2026-08-01T00:00:00.000Z" }),
      );
    }
    if (url.includes("/admin/api/menu/items")) return Promise.resolve(jsonResponse(overrides.items ?? ITEMS));
    if (url.includes("/admin/api/menu/categories")) return Promise.resolve(jsonResponse(CATEGORIES));
    if (url.includes("/admin/api/menu/modifier-groups")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/admin/api/menu/allergens")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/admin/api/menu/combos")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderMenu() {
  return render(
    <ToastProvider>
      <OutletProvider>
        <MenuManagement />
      </OutletProvider>
    </ToastProvider>,
  );
}

describe("MenuManagement list", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("shows a loading skeleton, then the item table", async () => {
    stubFetch();
    renderMenu();
    expect(screen.getByTestId("menu-loading")).toBeTruthy();
    await screen.findByTestId("menu-table");
    expect(screen.getByTestId("menu-item-row-1")).toBeTruthy();
    expect(screen.getByTestId("menu-item-row-2")).toBeTruthy();
  });

  it("shows a retryable error panel when the menu fails to load", async () => {
    stubFetch({ fail: true });
    renderMenu();
    expect(await screen.findByTestId("menu-load-error")).toBeTruthy();
  });

  it("filters the table down to a single category", async () => {
    stubFetch();
    renderMenu();
    await screen.findByTestId("menu-table");

    await userEvent.click(screen.getByTestId("menu-category-mains"));
    expect(screen.queryByTestId("menu-item-row-1")).toBeNull();
    expect(screen.getByTestId("menu-item-row-2")).toBeTruthy();
  });

  it("filters the table by search text across name", async () => {
    stubFetch();
    renderMenu();
    await screen.findByTestId("menu-table");

    await userEvent.type(screen.getByTestId("menu-search"), "Dal");
    expect(screen.queryByTestId("menu-item-row-1")).toBeNull();
    expect(screen.getByTestId("menu-item-row-2")).toBeTruthy();
  });

  it("shows the filtered-empty state (not the true-empty state) when filters match nothing", async () => {
    stubFetch();
    renderMenu();
    await screen.findByTestId("menu-table");

    await userEvent.type(screen.getByTestId("menu-search"), "nonexistent item");
    expect(await screen.findByTestId("menu-filtered-empty")).toBeTruthy();
    expect(screen.queryByTestId("menu-empty")).toBeNull();
  });

  it("shows the true-empty state with Import/Add actions for a menu with zero items", async () => {
    stubFetch({ items: [] });
    renderMenu();
    expect(await screen.findByTestId("menu-empty")).toBeTruthy();
    expect(screen.getByTestId("menu-empty-import")).toBeTruthy();
    expect(screen.getByTestId("menu-empty-add")).toBeTruthy();
  });

  it("opens the item drawer when a row is clicked, and Add Item opens it in create mode", async () => {
    stubFetch();
    renderMenu();
    await screen.findByTestId("menu-table");

    await userEvent.click(screen.getByTestId("menu-item-row-1"));
    expect(within(screen.getByTestId("item-drawer")).getByText("Edit Item")).toBeTruthy();
    await userEvent.click(screen.getByTestId("item-drawer-close"));

    await userEvent.click(screen.getByTestId("menu-add-item"));
    expect(within(screen.getByTestId("item-drawer")).getByText("Add Item")).toBeTruthy();
  });
});
