// Component tests for the real P3 order-taking screen (replaces story 3's
// order-stub.test.tsx). No live restiq-backend to verify against yet - see
// order-taking-state.ts's file header - so every network call is stubbed
// against this story's own self-authored contract, same convention as
// table-map.test.tsx.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderTakingView } from "./order-taking-view";
import type { OrderView, PosMenuView } from "./order-taking-state";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const MENU: PosMenuView = {
  currency: "INR",
  categories: [
    { id: "cat-tandoor", name: "Tandoor", sortOrder: 0 },
    { id: "cat-breads", name: "Breads", sortOrder: 1 },
  ],
  items: [
    {
      id: "item-paneer",
      categoryId: "cat-tandoor",
      name: "Paneer Tikka",
      shortName: "Paneer Tikka",
      available: true,
      priceMinor: null,
      variants: [
        { id: "v-half", name: "Half", priceMinor: 34000 },
        { id: "v-full", name: "Full", priceMinor: 56000 },
      ],
      modifierGroups: [
        {
          id: "g-spice",
          name: "Spice Level",
          minSelections: 1,
          maxSelections: 1,
          modifiers: [
            { id: "m-mild", name: "Mild", priceMinor: 0 },
            { id: "m-medium", name: "Medium", priceMinor: 0 },
          ],
        },
      ],
    },
    {
      id: "item-naan",
      categoryId: "cat-breads",
      name: "Butter Naan",
      shortName: "Butter Naan",
      available: true,
      priceMinor: 14000,
      variants: [],
      modifierGroups: [],
    },
  ],
};

function order(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: "order-t4-abcdef",
    tableId: "t4",
    tableLabel: "T4",
    status: "occupied",
    ownerStaffId: "staff-me",
    ownerStaffName: "Ravi",
    openedAt: new Date().toISOString(),
    currency: "INR",
    lines: [],
    totalMinor: 0,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OrderTakingView", () => {
  it("shows a loading skeleton before the order and menu land", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    expect(screen.getByTestId("order-taking-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());
  });

  it("shows a retryable error panel when the order fails to load", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse({ error: { message: "down" } }, 500)));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-error")).toBeTruthy());
  });

  it("shows a retryable error panel when the menu fails to load", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse({ error: { message: "down" } }, 500) : jsonResponse(order())));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-menu-error")).toBeTruthy());
  });

  it("renders the menu grid grouped by the first category and the empty order panel", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.getByTestId("item-tile-item-paneer")).toBeTruthy();
    expect(screen.queryByTestId("item-tile-item-naan")).toBeNull(); // Breads tab not active yet
    expect(screen.getByTestId("order-panel-empty")).toBeTruthy();
  });

  it("adding an item with no required modifiers works directly - no sheet needed", async () => {
    const user = userEvent.setup();
    const withNaan = order({
      lines: [
        {
          id: "line-1",
          itemId: "item-naan",
          itemName: "Butter Naan",
          variantId: null,
          variantName: null,
          quantity: 1,
          unitPriceMinor: 14000,
          modifiers: [],
          lineTotalMinor: 14000,
          specialInstructions: null,
          addedByStaffId: "staff-me",
          addedByStaffName: "Ravi",
          addedAt: new Date().toISOString(),
        },
      ],
      totalMinor: 14000,
    });
    stubFetch((url) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines")) return jsonResponse(withNaan);
      return jsonResponse(order());
    });
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    await user.click(screen.getByTestId("category-tab-cat-breads"));
    await user.click(screen.getByTestId("item-tile-item-naan"));

    // Unvaried, no-modifier-group item: no sheet at all, it's added straight away.
    expect(screen.queryByTestId("modifier-sheet")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("order-line-line-1")).toBeTruthy());
    expect(screen.getByTestId("order-panel-total").textContent).toBe("₹140");
    expect(within(screen.getByTestId("order-line-line-1")).getByTestId("order-line-added-by-line-1").textContent).toBe("Added by Ravi");
  });

  it("an item with a required modifier group blocks add until it's satisfied", async () => {
    const user = userEvent.setup();
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    await user.click(screen.getByTestId("item-tile-item-paneer"));
    const confirm = (await screen.findByTestId("modifier-sheet-confirm")) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // variant + required spice group both unsatisfied

    await user.click(screen.getByTestId("variant-chip-v-half"));
    expect(confirm.disabled).toBe(true); // spice group still unsatisfied

    await user.click(screen.getByTestId("modifier-chip-m-medium"));
    expect(confirm.disabled).toBe(false);
  });

  it("the order panel updates as lines are added", async () => {
    const user = userEvent.setup();
    const afterAdd = order({
      lines: [
        {
          id: "line-paneer",
          itemId: "item-paneer",
          itemName: "Paneer Tikka",
          variantId: "v-half",
          variantName: "Half",
          quantity: 1,
          unitPriceMinor: 34000,
          modifiers: [{ modifierId: "m-medium", name: "Medium", priceMinor: 0 }],
          lineTotalMinor: 34000,
          specialInstructions: null,
          addedByStaffId: "staff-me",
          addedByStaffName: "Ravi",
          addedAt: new Date().toISOString(),
        },
      ],
      totalMinor: 34000,
    });
    stubFetch((url) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines")) return jsonResponse(afterAdd);
      return jsonResponse(order());
    });
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());
    expect(screen.getByTestId("order-panel-total").textContent).toBe("₹0");

    await user.click(screen.getByTestId("item-tile-item-paneer"));
    await user.click(screen.getByTestId("variant-chip-v-half"));
    await user.click(screen.getByTestId("modifier-chip-m-medium"));
    await user.click(screen.getByTestId("modifier-sheet-confirm"));

    await waitFor(() => expect(screen.getByTestId("order-panel-total").textContent).toBe("₹340"));
    expect(screen.queryByTestId("modifier-sheet")).toBeNull();
    expect(screen.queryByTestId("order-panel-empty")).toBeNull();
  });

  it("incrementing a line's quantity calls the update endpoint and reflects the new total", async () => {
    const user = userEvent.setup();
    const oneLine = order({
      lines: [
        {
          id: "line-naan",
          itemId: "item-naan",
          itemName: "Butter Naan",
          variantId: null,
          variantName: null,
          quantity: 1,
          unitPriceMinor: 14000,
          modifiers: [],
          lineTotalMinor: 14000,
          specialInstructions: null,
          addedByStaffId: "staff-me",
          addedByStaffName: "Ravi",
          addedAt: new Date().toISOString(),
        },
      ],
      totalMinor: 14000,
    });
    const twoLines = { ...oneLine, lines: [{ ...oneLine.lines[0], quantity: 2, lineTotalMinor: 28000 }], totalMinor: 28000 };

    stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines/line-naan") && init?.method === "PATCH") return jsonResponse(twoLines);
      return jsonResponse(oneLine);
    });
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    await user.click(screen.getByTestId("order-line-increment-line-naan"));

    await waitFor(() => expect(screen.getByTestId("order-line-qty-line-naan").textContent).toBe("2"));
    expect(screen.getByTestId("order-panel-total").textContent).toBe("₹280");
  });

  it("decrementing a line to zero removes it via the delete endpoint", async () => {
    const user = userEvent.setup();
    const oneLine = order({
      lines: [
        {
          id: "line-naan",
          itemId: "item-naan",
          itemName: "Butter Naan",
          variantId: null,
          variantName: null,
          quantity: 1,
          unitPriceMinor: 14000,
          modifiers: [],
          lineTotalMinor: 14000,
          specialInstructions: null,
          addedByStaffId: "staff-me",
          addedByStaffName: "Ravi",
          addedAt: new Date().toISOString(),
        },
      ],
      totalMinor: 14000,
    });
    const emptied = { ...oneLine, lines: [], totalMinor: 0 };

    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines/line-naan") && init?.method === "DELETE") return jsonResponse(emptied);
      return jsonResponse(oneLine);
    });
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    await user.click(screen.getByTestId("order-line-decrement-line-naan"));

    await waitFor(() => expect(screen.getByTestId("order-panel-empty")).toBeTruthy());
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(true);
  });

  // --- CAP-4 group ordering: seat assignment and the send-to-kitchen gate.

  function lineFixture(overrides: Partial<import("./order-taking-state").OrderLineView> = {}) {
    return {
      id: "line-naan",
      itemId: "item-naan",
      itemName: "Butter Naan",
      variantId: null,
      variantName: null,
      quantity: 1,
      unitPriceMinor: 14000,
      modifiers: [],
      lineTotalMinor: 14000,
      specialInstructions: null,
      addedByStaffId: "staff-me",
      addedByStaffName: "Ravi",
      addedAt: new Date().toISOString(),
      seatNumber: null,
      ...overrides,
    };
  }

  it("assigning a seat to a line updates it", async () => {
    const user = userEvent.setup();
    const unseated = order({ lines: [lineFixture()], totalMinor: 14000 });
    const seated = { ...unseated, lines: [{ ...unseated.lines[0], seatNumber: 1 }] };

    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines/line-naan") && init?.method === "PATCH") return jsonResponse(seated);
      return jsonResponse(unseated);
    });
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    await user.click(screen.getByTestId("split-by-seat-toggle"));
    expect(screen.getByTestId("order-line-seat-line-naan").textContent).toBe("Unseated");

    await user.click(screen.getByTestId("order-line-seat-increment-line-naan"));

    await waitFor(() => expect(screen.getByTestId("order-line-seat-line-naan").textContent).toBe("Seat 1"));
    const patchCall = fetchMock.mock.calls.find(([url, init]) => (url as string).endsWith("/lines/line-naan") && (init as RequestInit | undefined)?.method === "PATCH");
    expect(patchCall).toBeTruthy();
    expect(JSON.parse((patchCall?.[1] as RequestInit).body as string)).toEqual({ seatNumber: 1 });
  });

  it("blocks sending to the kitchen while any line is unseated, naming the fix inline", async () => {
    const withUnseatedLine = order({ lines: [lineFixture()], totalMinor: 14000 });
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(withUnseatedLine)));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    const sendButton = screen.getByTestId("send-to-kitchen") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    expect(screen.getByTestId("send-to-kitchen-blocked").textContent).toContain("1 item needs a seat");
  });

  it("sending to the kitchen succeeds once every line is seated", async () => {
    const user = userEvent.setup();
    const fullySeated = order({ lines: [lineFixture({ seatNumber: 1 })], totalMinor: 14000 });
    const sent = { ...fullySeated, firedAt: "2026-08-25T10:00:00.000Z" };

    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/status") && init?.method === "PATCH") return jsonResponse(sent);
      return jsonResponse(fullySeated);
    });
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    const sendButton = screen.getByTestId("send-to-kitchen") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    expect(screen.queryByTestId("send-to-kitchen-blocked")).toBeNull();

    await user.click(sendButton);

    await waitFor(() => expect(screen.getByTestId("send-to-kitchen").textContent).toBe("Sent to kitchen"));
    const statusCall = fetchMock.mock.calls.find(([url, init]) => (url as string).endsWith("/status") && (init as RequestInit | undefined)?.method === "PATCH");
    expect(JSON.parse((statusCall?.[1] as RequestInit).body as string)).toEqual({ status: "sent" });
    expect((screen.getByTestId("send-to-kitchen") as HTMLButtonElement).disabled).toBe(true);
  });

  it("group ordering is invisible for an order with no lines - existing empty-order behavior is unaffected", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.queryByTestId("split-by-seat-toggle")).toBeNull();
    expect((screen.getByTestId("send-to-kitchen") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("send-to-kitchen-blocked")).toBeNull();
  });

  it("searching finds an item outside the active category tab", async () => {
    const user = userEvent.setup();
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    render(<OrderTakingView orderId="order-t4-abcdef" />);
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.queryByTestId("item-tile-item-naan")).toBeNull();
    await user.type(screen.getByTestId("menu-search"), "naan");
    expect(screen.getByTestId("item-tile-item-naan")).toBeTruthy();
    expect(screen.queryByTestId("item-tile-item-paneer")).toBeNull();
  });
});
