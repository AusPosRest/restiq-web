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

function stubFetch(overrides: { items?: unknown; fail?: boolean; route?: (url: string) => Response | undefined } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const routed = overrides.route?.(url);
    if (routed) return Promise.resolve(routed);
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

    await userEvent.click(screen.getByTestId("menu-empty-import"));
    expect(screen.getByTestId("menu-import-dialog")).toBeTruthy();
  });

  it("opens Import as a dialog over the menu instead of navigating away (issue #239)", async () => {
    stubFetch();
    renderMenu();
    await screen.findByTestId("menu-table");

    await userEvent.click(screen.getByTestId("menu-import-link"));
    const dialog = screen.getByTestId("menu-import-dialog");
    expect(within(dialog).getByTestId("menu-import-dropzone")).toBeTruthy();
    expect(within(dialog).getByTestId("menu-import-template-link")).toBeTruthy();

    await userEvent.click(screen.getByTestId("menu-import-dialog-close"));
    expect(screen.queryByTestId("menu-import-dialog")).toBeNull();
    expect(screen.getByTestId("menu-table")).toBeTruthy();
  });

  it("closes the dialog, reloads the list and confirms once an import commits (issue #239)", async () => {
    let committed = false;
    stubFetch({
      route: (url) => {
        if (url.includes("/admin/api/menu-import/upload")) {
          return jsonResponse(
            {
              importId: "imp-1",
              status: "draft",
              sourceType: "csv",
              fileName: "menu.csv",
              items: [
                {
                  id: "d1",
                  name: "Veg Samosa",
                  shortName: "Samosa",
                  category: "Tandoor",
                  priceMinor: 4000,
                  currency: "INR",
                  confidence: { name: 1, shortName: 1, category: 1, price: 1, overall: 1 },
                },
              ],
            },
            201,
          );
        }
        if (url.includes("/admin/api/menu-import/imp-1/commit")) {
          committed = true;
          return jsonResponse(
            {
              importId: "imp-1",
              committedAt: "2026-09-16T00:00:00.000Z",
              categories: [{ id: "tandoor", name: "Tandoor" }],
              items: [{ id: "3", name: "Veg Samosa", shortName: "Samosa", categoryId: "tandoor", price: { id: "p3", priceMinor: 4000, currency: "INR" } }],
            },
            201,
          );
        }
        if (committed && url.includes("/admin/api/menu/items") && !url.includes("price")) {
          return jsonResponse([...ITEMS, item({ id: "3", name: "Veg Samosa", shortName: "Samosa", categoryId: "tandoor" })]);
        }
        return undefined;
      },
    });
    renderMenu();
    await screen.findByTestId("menu-table");

    await userEvent.click(screen.getByTestId("menu-import-link"));
    await userEvent.upload(screen.getByTestId("menu-import-file-input"), new File(["name,price\nSamosa,40"], "menu.csv", { type: "text/csv" }));
    await userEvent.click(await screen.findByTestId("menu-import-row-d1-reviewed"));
    await userEvent.click(screen.getByTestId("menu-import-commit"));

    expect(await screen.findByTestId("menu-item-row-3")).toBeTruthy();
    expect(screen.queryByTestId("menu-import-dialog")).toBeNull();
    expect(screen.getByTestId("toast-success").textContent).toContain("1 item added to your menu");
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
