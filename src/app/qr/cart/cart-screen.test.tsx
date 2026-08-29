import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartScreen } from "./cart-screen";
import type { PlacedOrderView, TableCartView } from "./cart-api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const TWO_GUEST_CART: TableCartView = {
  sessionId: "s1",
  guests: [
    {
      guestId: "g1",
      guestName: "Ananya",
      subtotalMinor: 68000,
      lines: [
        {
          id: "l1",
          guestId: "g1",
          guestName: "Ananya",
          itemId: "i1",
          itemName: "Butter Chicken",
          variantId: null,
          variantName: null,
          quantity: 2,
          unitPriceMinor: 34000,
          modifiers: [],
          lineTotalMinor: 68000,
          createdAt: "2026-08-29T10:00:00.000Z",
        },
      ],
    },
    {
      guestId: "g2",
      guestName: "Rohan",
      subtotalMinor: 32000,
      lines: [
        {
          id: "l2",
          guestId: "g2",
          guestName: "Rohan",
          itemId: "i2",
          itemName: "Garlic Naan",
          variantId: null,
          variantName: null,
          quantity: 1,
          unitPriceMinor: 32000,
          modifiers: [],
          lineTotalMinor: 32000,
          createdAt: "2026-08-29T10:01:00.000Z",
        },
      ],
    },
  ],
  totalMinor: 100000,
  currency: "INR",
};

const EMPTY_CART: TableCartView = { sessionId: "s1", guests: [], totalMinor: 0, currency: "INR" };

// Shape copied field-for-field from restiq-backend PR #79's PlacedOrderView
// (src/guest/orders/orders.dtos.ts) - see cart-api.ts's own comment.
const PLACED_ORDER: PlacedOrderView = {
  orderId: "018f3ab2-9c4d-7e21-8a4b-11223344d4e5",
  tableId: "t1",
  status: "sent",
  source: "qr",
  sessionId: "s1",
  lines: [
    {
      id: "ol1",
      itemId: "i1",
      itemName: "Butter Chicken",
      variantId: null,
      variantName: null,
      quantity: 2,
      unitPriceMinor: 34000,
      seatNumber: 1,
      guestId: "g1",
      guestName: "Ananya",
      modifiers: [],
    },
    {
      id: "ol2",
      itemId: "i2",
      itemName: "Garlic Naan",
      variantId: null,
      variantName: null,
      quantity: 1,
      unitPriceMinor: 32000,
      seatNumber: 2,
      guestId: "g2",
      guestName: "Rohan",
      modifiers: [],
    },
  ],
};

/** Routes a fetch mock by exact "METHOD url" key, mirroring the real /qr/api pass-through's URLs. */
function routedFetch(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  return vi.fn((url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unhandled fetch: ${key}`);
    return Promise.resolve(handler());
  });
}

describe("CartScreen", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("groups by guest with per-guest subtotals and the combined total, rendered from the real shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);

    expect(await screen.findByTestId("cart-guest-g1")).toBeTruthy();
    expect(screen.getByTestId("cart-guest-g2")).toBeTruthy();
    expect(screen.getByTestId("cart-guest-subtotal-g1").textContent).toBe("₹680.00");
    expect(screen.getByTestId("cart-guest-subtotal-g2").textContent).toBe("₹320.00");
    expect(screen.getByTestId("cart-total").textContent).toBe("₹1000.00");
  });

  it("renders the signed-in guest's own lines editable and everyone else's read-only", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    expect(screen.getByTestId("cart-line-increment-l1")).toBeTruthy();
    expect(screen.getByTestId("cart-line-decrement-l1")).toBeTruthy();
    expect(screen.getByTestId("cart-line-remove-l1")).toBeTruthy();

    expect(screen.queryByTestId("cart-line-increment-l2")).toBeNull();
    expect(screen.queryByTestId("cart-line-decrement-l2")).toBeNull();
    expect(screen.queryByTestId("cart-line-remove-l2")).toBeNull();
    expect(screen.getByTestId("cart-line-qty-readonly-l2").textContent).toBe("×1");
  });

  it("marks the signed-in guest's own GuestChip distinctly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    expect(screen.getAllByTestId("guest-chip-mine")).toHaveLength(1);
    expect(screen.getAllByTestId("guest-chip")).toHaveLength(1);
  });

  it("incrementing an own line calls the quantity PATCH endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, TWO_GUEST_CART)).mockResolvedValueOnce(jsonResponse(200, TWO_GUEST_CART));
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-line-increment-l1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/qr/api/cart/lines/l1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ quantity: 3 });
  });

  it("decrementing a line at quantity 1 removes it instead of PATCHing to 0", async () => {
    const oneQtyCart: TableCartView = {
      ...TWO_GUEST_CART,
      guests: [{ guestId: "g1", guestName: "Ananya", subtotalMinor: 34000, lines: [{ ...TWO_GUEST_CART.guests[0].lines[0], quantity: 1 }] }],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, oneQtyCart)).mockResolvedValueOnce(jsonResponse(200, oneQtyCart));
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-line-decrement-l1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/qr/api/cart/lines/l1");
    expect(init.method).toBe("DELETE");
  });

  it("remove calls the DELETE endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, TWO_GUEST_CART)).mockResolvedValueOnce(jsonResponse(200, TWO_GUEST_CART));
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-line-remove-l1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/qr/api/cart/lines/l1");
    expect(init.method).toBe("DELETE");
  });

  it("shows an inviting empty state linking back to the menu when the cart has no lines yet", async () => {
    const empty: TableCartView = { sessionId: "s1", guests: [], totalMinor: 0, currency: "INR" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, empty)));
    render(<CartScreen myGuestId="g1" />);

    expect(await screen.findByTestId("cart-empty")).toBeTruthy();
    const link = screen.getByTestId("cart-empty-browse-menu") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/qr/menu");
  });

  it("shows a session-ended state on a 410, never a dead screen or auth error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(410, { error: { code: "session_closed", message: "closed" } })));
    render(<CartScreen myGuestId="g1" />);

    expect(await screen.findByTestId("cart-session-ended")).toBeTruthy();
  });

  it("has an aria-live region over the shared cart so convergence is announced", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    const region = screen.getByLabelText("Shared table cart");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });
});

describe("CartScreen - Place order (CAP-4)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("enables Place order once the cart has items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    expect((screen.getByTestId("cart-place-order") as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Place order while the cart is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, EMPTY_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-empty");

    expect((screen.getByTestId("cart-place-order") as HTMLButtonElement).disabled).toBe(true);
  });

  it("posts the real placement endpoint and renders the confirmation from the real PlacedOrderView shape", async () => {
    const fetchMock = routedFetch({
      "GET /qr/api/cart": () => jsonResponse(200, TWO_GUEST_CART),
      "POST /qr/api/orders": () => jsonResponse(201, PLACED_ORDER),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-place-order"));

    expect(await screen.findByTestId("cart-placed")).toBeTruthy();
    expect(screen.getByTestId("cart-placed-order-id").textContent).toBe("Order #44D4E5");
    expect(screen.getByTestId("cart-placed-guest-g1").textContent).toContain("Ananya");
    expect(screen.getByTestId("cart-placed-line-ol1").textContent).toContain("Butter Chicken");
    expect(screen.getByTestId("cart-placed-line-ol1").textContent).toContain("×2");
    expect(screen.getByTestId("cart-placed-guest-g2").textContent).toContain("Rohan");
    expect(screen.getByTestId("cart-placed-line-ol2").textContent).toContain("Garlic Naan");
    const track = screen.getByTestId("cart-track-order") as HTMLAnchorElement;
    expect(track.getAttribute("href")).toBe("/qr/status");
    const requestBill = screen.getByTestId("cart-request-bill") as HTMLAnchorElement;
    expect(requestBill.getAttribute("href")).toBe(`/qr/checkout?orderId=${PLACED_ORDER.orderId}`);

    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/qr/api/orders") as [string, RequestInit];
    expect(init.method).toBe("POST");
  });

  it("routes a 410 on placement to the existing session-ended state", async () => {
    const fetchMock = routedFetch({
      "GET /qr/api/cart": () => jsonResponse(200, TWO_GUEST_CART),
      "POST /qr/api/orders": () => jsonResponse(410, { error: { code: "session_closed", message: "This table session has ended" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-place-order"));

    expect(await screen.findByTestId("cart-session-ended")).toBeTruthy();
  });

  it("shows a plain inline error on no_price", async () => {
    const fetchMock = routedFetch({
      "GET /qr/api/cart": () => jsonResponse(200, TWO_GUEST_CART),
      "POST /qr/api/orders": () =>
        jsonResponse(400, { error: { code: "no_price", message: "No current price is configured for one of the items in this cart" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-place-order"));

    const error = await screen.findByTestId("cart-place-order-error");
    expect(error.textContent).toBe("No current price is configured for one of the items in this cart");
    expect(screen.queryByTestId("cart-placed")).toBeNull();
  });

  it("converges to the placed state, not an error, when another guest's place already consumed the cart (concurrent placement)", async () => {
    let cartFetches = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/qr/api/cart" && method === "GET") {
        cartFetches += 1;
        // First load sees the cart this guest is about to try to place;
        // the re-fetch after the race reads back empty, exactly like the
        // real backend after another guest's placeOrder() transaction
        // already deleted the session's CartLines.
        return Promise.resolve(jsonResponse(200, cartFetches === 1 ? TWO_GUEST_CART : EMPTY_CART));
      }
      if (url === "/qr/api/orders" && method === "POST") {
        // The real orders.service.ts throws exactly this - BadRequestException({ code: 'empty_cart', ... }) -
        // when placeOrder() finds no CartLines left, which is also the code path a genuinely empty cart takes.
        return Promise.resolve(jsonResponse(400, { error: { code: "empty_cart", message: "Add at least one item to the cart before placing the order" } }));
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    await userEvent.click(screen.getByTestId("cart-place-order"));

    expect(await screen.findByTestId("cart-order-placed-elsewhere")).toBeTruthy();
    expect(screen.queryByTestId("cart-place-order-error")).toBeNull();
    const track = screen.getByTestId("cart-track-order") as HTMLAnchorElement;
    expect(track.getAttribute("href")).toBe("/qr/status");
  });
});
