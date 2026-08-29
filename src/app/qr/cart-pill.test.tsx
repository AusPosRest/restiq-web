import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartPill } from "./cart-pill";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("CartPill", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders nothing while the cart is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { sessionId: "s1", guests: [], totalMinor: 0, currency: "INR" })));

    render(<CartPill />);

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(screen.queryByTestId("qr-cart-pill")).toBeNull();
  });

  it("shows the real item count and total once the cart has lines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          sessionId: "s1",
          guests: [{ guestId: "g1", guestName: "Ananya", lines: [{ quantity: 2 }], subtotalMinor: 64000 }],
          totalMinor: 64000,
          currency: "INR",
        }),
      ),
    );

    render(<CartPill />);

    const pill = await screen.findByTestId("qr-cart-pill");
    expect(pill.textContent).toContain("2 items");
    expect(pill.textContent).toContain("₹640");
  });
});
