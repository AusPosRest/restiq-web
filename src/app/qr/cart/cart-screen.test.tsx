import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartScreen } from "./cart-screen";
import type { TableCartView } from "./cart-api";

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

  it("renders the Place order CTA disabled with a quiet coming-next note (CAP-4 is a later story)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    const cta = screen.getByTestId("cart-place-order") as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(screen.getByText("Placing the order is coming next")).toBeTruthy();
  });

  it("has an aria-live region over the shared cart so convergence is announced", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, TWO_GUEST_CART)));
    render(<CartScreen myGuestId="g1" />);
    await screen.findByTestId("cart-line-l1");

    const region = screen.getByLabelText("Shared table cart");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });
});
