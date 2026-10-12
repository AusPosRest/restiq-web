import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuView } from "./menu-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const MENU = {
  outletId: "o1",
  categories: [
    {
      id: "c1",
      name: "Starters",
      sortOrder: 0,
      items: [
        { id: "i1", categoryId: "c1", name: "Paneer Tikka", shortName: "Paneer Tikka", available: true, priceMinor: 32000, currency: "INR", variants: [], modifierGroups: [], allergens: [{ id: "a1", name: "Dairy" }] },
        { id: "i2", categoryId: "c1", name: "Chicken Wings", shortName: "Wings", available: false, priceMinor: 28000, currency: "INR", variants: [], modifierGroups: [], allergens: [] },
      ],
    },
    { id: "c2", name: "Mains", sortOrder: 1, items: [{ id: "i3", categoryId: "c2", name: "Butter Chicken", shortName: "Butter Chicken", available: true, priceMinor: 45000, currency: "INR", variants: [], modifierGroups: [], allergens: [] }] },
    { id: "c3", name: "Nothing Here", sortOrder: 2, items: [] },
  ],
};

// Issue #218: a photo on Paneer Tikka, and an item that needs a choice before it can be added.
const MENU_PLUS = {
  ...MENU,
  categories: [
    {
      ...MENU.categories[0],
      items: [
        { ...MENU.categories[0].items[0], photoUrl: "https://cdn.example.com/paneer.jpg" },
        MENU.categories[0].items[1],
        {
          id: "i4", categoryId: "c1", name: "Masala Dosa", shortName: "Dosa", available: true, priceMinor: 15000, currency: "INR", variants: [], allergens: [],
          modifierGroups: [{ id: "g1", name: "Chutney", minSelections: 1, maxSelections: 1, modifiers: [{ id: "m1", name: "Coconut", priceMinor: 0 }] }],
        },
      ],
    },
    ...MENU.categories.slice(1),
  ],
};

/** A fresh Response per call (a body can only be read once), routed by "METHOD url". */
function routeFetch(routes: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    if (routes[key]) return Promise.resolve(routes[key]());
    if (key === "GET /qr/api/menu") return Promise.resolve(jsonResponse(200, MENU_PLUS));
    return Promise.resolve(jsonResponse(404, {}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MenuView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
    sessionStorage.clear();
    cleanup();
  });

  it("the + adds a simple item straight to the cart without opening it", async () => {
    const fetchMock = routeFetch({ "POST /qr/api/cart/lines": () => jsonResponse(201, {}) });
    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    fireEvent.click(screen.getByTestId("qr-menu-add-i1"));
    expect((await screen.findByTestId("qr-menu-notice")).textContent).toBe("Added Paneer Tikka");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ itemId: "i1", quantity: 1, modifierIds: [] });
    expect(push).not.toHaveBeenCalled();
  });

  it("the + on an item with a required choice opens its detail instead", async () => {
    const fetchMock = routeFetch();
    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    fireEvent.click(screen.getByTestId("qr-menu-add-i4"));
    expect(push).toHaveBeenCalledWith("/qr/menu/i4");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("shows a failed quick add without leaving the menu", async () => {
    routeFetch({ "POST /qr/api/cart/lines": () => jsonResponse(409, { error: { code: "item_unavailable", message: "x" } }) });
    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    fireEvent.click(screen.getByTestId("qr-menu-add-i1"));
    const notice = await screen.findByTestId("qr-menu-notice");
    expect(notice.getAttribute("role")).toBe("alert");
    expect(notice.textContent).toBe("Paneer Tikka just became unavailable");
  });

  it("shows the item photo, and the letter tile when there is none", async () => {
    routeFetch();
    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    expect(screen.getByTestId("qr-menu-item-photo-i1").getAttribute("src")).toBe("https://cdn.example.com/paneer.jpg");
    expect(screen.queryByTestId("qr-menu-item-photo-i4")).toBeNull();
  });

  it("a kiosk tab gets the category rail and photo grid", async () => {
    sessionStorage.setItem("device:enrolled", JSON.stringify({ id: "k1", tenantId: "t", outletId: "o1", label: "K", type: "kiosk", role: "terminal", status: "active", enrolledAt: "", revokedAt: null }));
    routeFetch();
    render(<MenuView />);

    expect((await screen.findByTestId("qr-menu")).getAttribute("data-layout")).toBe("kiosk");
    expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe("vertical");
  });

  it("renders non-empty categories as tabs, skipping the hollow one, and shows items for the active tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, MENU)));

    render(<MenuView />);

    await screen.findByTestId("qr-menu");
    expect(screen.getByTestId("qr-menu-tab-c1")).toBeTruthy();
    expect(screen.getByTestId("qr-menu-tab-c2")).toBeTruthy();
    expect(screen.queryByTestId("qr-menu-tab-c3")).toBeNull();
    expect(screen.getByTestId("qr-menu-item-i1")).toBeTruthy();
    expect(screen.queryByTestId("qr-menu-item-i3")).toBeNull();
  });

  it("marks an unavailable item as such, visible but not addable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, MENU)));

    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    const card = screen.getByTestId("qr-menu-item-i2");
    expect(screen.getByTestId("qr-menu-item-unavailable-i2").textContent).toContain("Unavailable today");
    expect(card.getAttribute("role")).toBeNull();
    expect(screen.queryByTestId("qr-menu-add-i2")).toBeNull();
    fireEvent.click(card);
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to item detail when an available item is tapped", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, MENU)));

    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    fireEvent.click(screen.getByTestId("qr-menu-item-i1"));
    expect(push).toHaveBeenCalledWith("/qr/menu/i1");
  });

  it("searches across every category regardless of the active tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, MENU)));

    render(<MenuView />);
    await screen.findByTestId("qr-menu");

    fireEvent.change(screen.getByTestId("qr-menu-search"), { target: { value: "butter" } });
    await waitFor(() => expect(screen.getByTestId("qr-menu-item-i3")).toBeTruthy());
    expect(screen.queryByTestId("qr-menu-item-i1")).toBeNull();
  });

  it("shows the friendly session-ended view on a 410", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(410, { error: { code: "session_closed" } })));

    render(<MenuView />);

    expect(await screen.findByTestId("qr-session-ended")).toBeTruthy();
  });

  it("shows a retryable error, not a raw crash, when the menu can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    render(<MenuView />);

    expect(await screen.findByTestId("qr-menu-error")).toBeTruthy();
  });
});
