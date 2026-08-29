import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemDetailView } from "./item-detail-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const SIMPLE_ITEM = {
  id: "i1",
  categoryId: "c1",
  name: "Garlic Naan",
  shortName: "Garlic Naan",
  available: true,
  priceMinor: 7500,
  currency: "INR",
  variants: [],
  modifierGroups: [],
  allergens: [],
};

const ITEM_WITH_VARIANT_AND_MODIFIER = {
  id: "i2",
  categoryId: "c1",
  name: "Paneer Tikka",
  shortName: "Paneer Tikka",
  available: true,
  priceMinor: null,
  currency: null,
  variants: [
    { id: "v-half", name: "Half", sortOrder: 0, priceMinor: 32000, currency: "INR" },
    { id: "v-full", name: "Full", sortOrder: 1, priceMinor: 48000, currency: "INR" },
  ],
  modifierGroups: [
    {
      id: "g1",
      name: "Spice Level",
      minSelections: 1,
      maxSelections: 1,
      modifiers: [
        { id: "m-mild", name: "Mild", priceMinor: 0 },
        { id: "m-hot", name: "Hot", priceMinor: 0 },
      ],
    },
  ],
  allergens: [{ id: "a1", name: "Dairy" }],
};

const CART_RESPONSE = { sessionId: "s1", guests: [], totalMinor: 0, currency: "INR" };

function fetchRouter(byUrl: Record<string, Response | (() => Response) | (() => Promise<Response>)>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const key = Object.keys(byUrl).find((k) => url.includes(k));
    if (!key) throw new Error(`Unexpected fetch: ${url}`);
    const value = byUrl[key];
    return typeof value === "function" ? value() : value;
  });
}

describe("ItemDetailView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
    cleanup();
  });

  it("adds a simple item with nothing to configure straight away", async () => {
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        "/menu/items/i1": jsonResponse(200, SIMPLE_ITEM),
        "/api/cart": jsonResponse(200, CART_RESPONSE),
      }),
    );

    render(<ItemDetailView itemId="i1" />);
    await screen.findByTestId("qr-item-detail");

    const addButton = screen.getByTestId("qr-add-to-cart");
    expect(addButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(addButton);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/qr/menu"));
  });

  it("gates add-to-cart on a required variant and modifier group being satisfied", async () => {
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        "/menu/items/i2": jsonResponse(200, ITEM_WITH_VARIANT_AND_MODIFIER),
        "/api/cart": jsonResponse(200, CART_RESPONSE),
      }),
    );

    render(<ItemDetailView itemId="i2" />);
    await screen.findByTestId("qr-item-detail");

    const addButton = screen.getByTestId("qr-add-to-cart");
    expect(addButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByTestId("qr-variant-v-half"));
    expect(addButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByTestId("qr-modifier-m-mild"));
    expect(addButton.hasAttribute("disabled")).toBe(false);
  });

  it("shows the min/max badge for a required modifier group", async () => {
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        "/menu/items/i2": jsonResponse(200, ITEM_WITH_VARIANT_AND_MODIFIER),
        "/api/cart": jsonResponse(200, CART_RESPONSE),
      }),
    );

    render(<ItemDetailView itemId="i2" />);
    await screen.findByTestId("qr-item-detail");

    expect(screen.getByTestId("qr-modifier-group-badge-g1").textContent).toBe("Required · choose 1");
  });

  it("posts the exact body the real cart endpoint expects", async () => {
    const cartPost = vi.fn().mockResolvedValue(jsonResponse(200, CART_RESPONSE));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/menu/items/i2")) return jsonResponse(200, ITEM_WITH_VARIANT_AND_MODIFIER);
      if (url.includes("/api/cart/lines")) return cartPost(init);
      if (url.includes("/api/cart")) return jsonResponse(200, CART_RESPONSE);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<ItemDetailView itemId="i2" />);
    await screen.findByTestId("qr-item-detail");

    fireEvent.click(screen.getByTestId("qr-variant-v-half"));
    fireEvent.click(screen.getByTestId("qr-modifier-m-hot"));
    fireEvent.click(screen.getByTestId("qr-qty-increment"));
    fireEvent.click(screen.getByTestId("qr-add-to-cart"));

    await waitFor(() => expect(cartPost).toHaveBeenCalled());
    const body = JSON.parse((cartPost.mock.calls[0][0] as RequestInit).body as string);
    expect(body).toEqual({ itemId: "i2", variantId: "v-half", quantity: 2, modifierIds: ["m-hot"] });
  });

  it("shows an inline error naming the cause when the cart rejects the add, without navigating away", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/menu/items/i1")) return jsonResponse(200, SIMPLE_ITEM);
      if (url.includes("/api/cart/lines")) return jsonResponse(400, { error: { code: "item_unavailable", message: "This item is currently unavailable" } });
      if (url.includes("/api/cart")) return jsonResponse(200, CART_RESPONSE);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<ItemDetailView itemId="i1" />);
    await screen.findByTestId("qr-item-detail");

    fireEvent.click(screen.getByTestId("qr-add-to-cart"));

    expect(await screen.findByTestId("qr-item-detail-add-error")).toHaveProperty("textContent", "This item just became unavailable");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the friendly session-ended view on a 410 when loading the item", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(410, { error: { code: "session_closed" } })));

    render(<ItemDetailView itemId="i1" />);

    expect(await screen.findByTestId("qr-session-ended")).toBeTruthy();
  });

  it("never allows adding an unavailable item, even with no configuration required", async () => {
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        "/menu/items/i1": jsonResponse(200, { ...SIMPLE_ITEM, available: false }),
        "/api/cart": jsonResponse(200, CART_RESPONSE),
      }),
    );

    render(<ItemDetailView itemId="i1" />);
    await screen.findByTestId("qr-item-detail");

    expect(screen.getByTestId("qr-item-detail-unavailable").textContent).toBe("Unavailable today");
    expect(screen.getByTestId("qr-add-to-cart").hasAttribute("disabled")).toBe(true);
  });
});
