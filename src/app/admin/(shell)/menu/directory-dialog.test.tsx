// Browse directory dialog (issue #245): search + tag filter, tick products,
// import posts the selected ids and hands the count back to the menu.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DirectoryProduct } from "../../api";
import { ToastProvider } from "../toast";
import { DirectoryDialog } from "./directory-dialog";

const PANEER: DirectoryProduct = {
  id: "p-paneer",
  name: "Paneer Tikka",
  shortName: "Pnr Tikka",
  nameHindi: null,
  vegMarker: "veg",
  photoUrl: null,
  category: "Starters",
  suggestedPriceMinor: 24900,
  currency: "INR",
  tags: ["veg", "grill"],
};
const CHICKEN: DirectoryProduct = { ...PANEER, id: "p-chicken", name: "Butter Chicken", vegMarker: "non_veg", category: "Mains", tags: ["north-indian"] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(importStatus = 201) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/admin/api/menu/directory/tags") return Promise.resolve(jsonResponse({ tags: ["grill", "north-indian", "veg"] }));
    if (url.pathname === "/admin/api/menu/directory/import") {
      if (importStatus !== 201) return Promise.resolve(jsonResponse({ error: { code: "conflict", message: "Already on your menu" } }, importStatus));
      const { productIds } = JSON.parse(String(init?.body)) as { productIds: string[] };
      return Promise.resolve(jsonResponse({ categories: [], items: productIds.map((id) => ({ id: `item-${id}`, name: id })) }, 201));
    }
    if (url.pathname === "/admin/api/menu/directory") {
      const tag = url.searchParams.get("tag");
      const q = url.searchParams.get("q")?.toLowerCase();
      let list = [PANEER, CHICKEN];
      if (tag) list = list.filter((p) => p.tags.includes(tag));
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
      return Promise.resolve(jsonResponse({ products: list }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDialog(onImported = vi.fn()) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <DirectoryDialog open onClose={onClose} onImported={onImported} />
    </ToastProvider>,
  );
  return { onClose, onImported };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DirectoryDialog", () => {
  it("filters by search and tag, and imports the ticked products", async () => {
    const fetchMock = stubFetch();
    const { onImported } = renderDialog();
    expect(await screen.findByTestId("directory-row-p-paneer")).toBeTruthy();
    expect(screen.getByTestId("directory-import").hasAttribute("disabled")).toBe(true);

    await userEvent.click(await screen.findByTestId("directory-tag-north-indian"));
    await waitFor(() => expect(screen.queryByTestId("directory-row-p-paneer")).toBeNull());
    await userEvent.click(screen.getByTestId("directory-select-p-chicken"));
    expect(screen.getByTestId("directory-selected-count").textContent).toBe("1 selected");

    await userEvent.click(screen.getByTestId("directory-tag-north-indian"));
    await userEvent.type(screen.getByTestId("directory-search"), "paneer");
    await waitFor(() => expect(screen.queryByTestId("directory-row-p-chicken")).toBeNull());
    await userEvent.click(screen.getByTestId("directory-select-p-paneer"));
    expect(screen.getByTestId("directory-import").textContent).toBe("Import 2 items");

    await userEvent.click(screen.getByTestId("directory-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(2));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ productIds: ["p-chicken", "p-paneer"] });
  });

  it("surfaces the backend's conflict message and keeps the dialog open", async () => {
    stubFetch(409);
    const { onImported } = renderDialog();
    await userEvent.click(await screen.findByTestId("directory-select-p-paneer"));
    await userEvent.click(screen.getByTestId("directory-import"));
    expect(await screen.findByText("Already on your menu")).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
    expect(screen.getByTestId("directory-dialog")).toBeTruthy();
  });
});
