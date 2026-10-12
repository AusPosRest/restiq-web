// Product directory console (issue #245): list with tag filter, add through
// the dialog, delete through the reason dialog.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { CatalogIndex } from "./catalog-index";
import type { CatalogProduct } from "./catalog-state";

const PANEER: CatalogProduct = {
  id: "0192aaaa-0000-7000-8000-000000000001",
  name: "Paneer Tikka",
  shortName: "Pnr Tikka",
  nameHindi: null,
  vegMarker: "veg",
  photoUrl: null,
  category: "Starters",
  suggestedPriceMinor: 24900,
  currency: "INR",
  tags: ["veg", "grill"],
  updatedAt: "2026-09-16T00:00:00.000Z",
};
const PIE: CatalogProduct = { ...PANEER, id: "0192aaaa-0000-7000-8000-000000000002", name: "Meat Pie", shortName: "Pie", vegMarker: null, category: "Mains", suggestedPriceMinor: 1200, currency: "AUD", tags: ["bakery"] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch() {
  let list = [PANEER, PIE];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    if (url.pathname === "/ops/api/catalog/products/tags") return Promise.resolve(jsonResponse({ tags: ["bakery", "grill", "veg"] }));
    if (url.pathname === "/ops/api/catalog/products" && method === "GET") {
      const tag = url.searchParams.get("tag");
      return Promise.resolve(jsonResponse({ products: tag ? list.filter((p) => p.tags.includes(tag)) : list }));
    }
    if (url.pathname === "/ops/api/catalog/products" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Partial<CatalogProduct>;
      const created = { ...PANEER, ...body, id: "0192aaaa-0000-7000-8000-000000000003" } as CatalogProduct;
      list = [...list, created];
      return Promise.resolve(jsonResponse({ product: created }, 201));
    }
    const match = url.pathname.match(/\/ops\/api\/catalog\/products\/([^/]+)$/);
    if (match && method === "DELETE") {
      list = list.filter((p) => p.id !== match[1]);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderIndex() {
  return render(
    <ToastProvider>
      <CatalogIndex />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CatalogIndex", () => {
  it("lists products and filters by tag chip", async () => {
    stubFetch();
    renderIndex();
    expect(await screen.findByTestId(`catalog-row-${PANEER.id}`)).toBeTruthy();
    expect(screen.getByTestId(`catalog-row-${PIE.id}`)).toBeTruthy();

    await userEvent.click(await screen.findByTestId("catalog-tag-bakery"));
    await waitFor(() => expect(screen.queryByTestId(`catalog-row-${PANEER.id}`)).toBeNull());
    expect(screen.getByTestId(`catalog-row-${PIE.id}`)).toBeTruthy();
    expect(screen.getByTestId("catalog-tag-bakery").getAttribute("aria-pressed")).toBe("true");
  });

  it("adds a product through the dialog and posts the normalised payload", async () => {
    const fetchMock = stubFetch();
    renderIndex();
    await screen.findByTestId(`catalog-row-${PANEER.id}`);
    await userEvent.click(screen.getByTestId("catalog-add"));
    const dialog = screen.getByTestId("catalog-product-dialog");
    await userEvent.click(within(dialog).getByTestId("catalog-save"));
    expect(within(dialog).getByTestId("catalog-form-error").textContent).toBe("Name is required.");

    await userEvent.type(within(dialog).getByTestId("catalog-name"), "Dal Makhani");
    await userEvent.type(within(dialog).getByTestId("catalog-short-name"), "Dal");
    await userEvent.type(within(dialog).getByTestId("catalog-category"), "Mains");
    await userEvent.type(within(dialog).getByTestId("catalog-price"), "199");
    await userEvent.type(within(dialog).getByTestId("catalog-tags-input"), "Veg, north-indian");
    await userEvent.click(within(dialog).getByTestId("catalog-save"));

    await waitFor(() => expect(screen.queryByTestId("catalog-product-dialog")).toBeNull());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ name: "Dal Makhani", suggestedPriceMinor: 19900, currency: "INR", tags: ["veg", "north-indian"] });
    expect(await screen.findByTestId("catalog-row-0192aaaa-0000-7000-8000-000000000003")).toBeTruthy();
  });

  it("deletes through the reason dialog and sends the reason", async () => {
    const fetchMock = stubFetch();
    renderIndex();
    await screen.findByTestId(`catalog-row-${PIE.id}`);
    await userEvent.click(screen.getByTestId(`catalog-delete-${PIE.id}`));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Discontinued");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByTestId(`catalog-row-${PIE.id}`)).toBeNull());
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(String(del?.[0])).toBe(`/ops/api/catalog/products/${PIE.id}?reason=Discontinued`);
  });
});
