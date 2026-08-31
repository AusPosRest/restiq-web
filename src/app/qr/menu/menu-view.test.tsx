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

describe("MenuView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
    cleanup();
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
