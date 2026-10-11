// Component tests for the real P3 order-taking screen. Every network call is
// stubbed against the real, verified restiq-backend wire shape (RawOrder/
// RawOrderLine, orders.dtos.ts) - order-taking-state.ts's `toOrderView`/
// `toOrderLineView` do the item/variant-name join against the loaded menu,
// same as the production code path.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderTakingView } from "./order-taking-view";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush, replace: vi.fn() }) }));
import type { PosMenuView, RawOrder } from "./order-taking-state";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CURRENT_STAFF_ID = "staff-me";
const ORDER_ID = "order-t4-abcdef";

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

/** A fixture shaped exactly like the real backend's `GET /pos/v1/orders/:id` (and every order-line mutation's) response. */
function order(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    id: ORDER_ID,
    tenantId: "tenant-1",
    outletId: "outlet-1",
    tableId: "t4",
    tableLabel: "T4",
    ownerId: CURRENT_STAFF_ID,
    status: "open",
    tokenNumber: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines: [],
    ...overrides,
  };
}

function renderView() {
  return render(<OrderTakingView orderId={ORDER_ID} currentStaffId={CURRENT_STAFF_ID} />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OrderTakingView", () => {
  it("shows a loading skeleton before the order and menu land", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    renderView();
    expect(screen.getByTestId("order-taking-loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());
  });

  it("shows a retryable error panel when the order fails to load", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse({ error: { message: "down" } }, 500)));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-error")).toBeTruthy());
  });

  it("shows a retryable error panel when the menu fails to load", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse({ error: { message: "down" } }, 500) : jsonResponse(order())));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-menu-error")).toBeTruthy());
  });

  it("renders the menu grid grouped by the first category, the empty order panel, and the real table label - never the raw table id (regression for #96)", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.getByTestId("item-tile-item-paneer")).toBeTruthy();
    expect(screen.queryByTestId("item-tile-item-naan")).toBeNull(); // Breads tab not active yet
    expect(screen.getByTestId("order-panel-empty")).toBeTruthy();
    // Rendered both in the header and the order panel - the real table label, not the raw id.
    expect(screen.getAllByText("Table T4").length).toBeGreaterThan(0);
    expect(screen.queryByText("Table t4")).toBeNull();
  });

  it('shows "You" for the signed-in staff\'s own order, not their raw id', async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order({ ownerId: CURRENT_STAFF_ID }))));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());
    expect(screen.getByTestId("order-owner").textContent).toContain("You");
  });

  it("shows the owner's name, never their id, on someone else's order - read-only with a Take over action (SE-22)", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/transfer") && init?.method === "POST") return jsonResponse(order({ ownerId: CURRENT_STAFF_ID, ownerName: "Me" }));
      return jsonResponse(order({ ownerId: "staff-priya", ownerName: "Priya" }));
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());
    expect(screen.getByTestId("order-owner").textContent).toContain("Priya");
    expect(screen.getByTestId("order-owner").textContent).not.toContain("staff-priya");
    expect(screen.getByTestId("order-not-yours").textContent).toContain("belongs to Priya");
    expect(screen.queryByTestId("discard-order")).toBeNull();

    await user.click(screen.getByTestId("order-take-over"));
    await waitFor(() => expect(screen.queryByTestId("order-not-yours")).toBeNull());
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual({ newOwnerStaffId: CURRENT_STAFF_ID });
    expect(screen.getByTestId("order-owner").textContent).toContain("You");
  });

  it("adding an item with no required modifiers works directly - no sheet needed, item name resolved from the menu", async () => {
    const user = userEvent.setup();
    const withNaan = order({
      lines: [
        {
          id: "line-1",
          orderId: ORDER_ID,
          itemId: "item-naan",
          variantId: null,
          quantity: 1,
          unitPriceMinor: 14000,
          seatNumber: null,
          addedByStaffId: CURRENT_STAFF_ID,
          createdAt: new Date().toISOString(),
          modifiers: [],
        },
      ],
    });
    stubFetch((url) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines")) return jsonResponse(withNaan);
      return jsonResponse(order());
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    await user.click(screen.getByTestId("category-tab-cat-breads"));
    await user.click(screen.getByTestId("item-tile-item-naan"));

    // Unvaried, no-modifier-group item: no sheet at all, it's added straight away.
    expect(screen.queryByTestId("modifier-sheet")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("order-line-line-1")).toBeTruthy());
    expect(screen.getByTestId("order-panel-total").textContent).toBe("₹140");
    expect(within(screen.getByTestId("order-line-line-1")).getByText("Butter Naan")).toBeTruthy();
    expect(within(screen.getByTestId("order-line-line-1")).getByTestId("order-line-added-by-line-1").textContent).toBe("Added by You");
  });

  it("tapping the same plain item again increments its existing line instead of adding a duplicate (regression for #63)", async () => {
    const user = userEvent.setup();
    const afterAdd = order({
      lines: [
        {
          id: "line-1",
          orderId: ORDER_ID,
          itemId: "item-naan",
          variantId: null,
          quantity: 1,
          unitPriceMinor: 14000,
          seatNumber: null,
          addedByStaffId: CURRENT_STAFF_ID,
          createdAt: new Date().toISOString(),
          modifiers: [],
        },
      ],
    });
    const afterIncrement = order({ lines: afterAdd.lines.map((line) => ({ ...line, quantity: 2 })) });
    let addCalls = 0;
    let patchCalls = 0;
    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines")) {
        addCalls += 1;
        return jsonResponse(afterAdd);
      }
      if (url.endsWith("/lines/line-1") && init?.method === "PATCH") {
        patchCalls += 1;
        return jsonResponse(afterIncrement);
      }
      return jsonResponse(order());
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    await user.click(screen.getByTestId("category-tab-cat-breads"));
    await user.click(screen.getByTestId("item-tile-item-naan"));
    await waitFor(() => expect(screen.getByTestId("order-line-line-1")).toBeTruthy());

    await user.click(screen.getByTestId("item-tile-item-naan"));
    await waitFor(() => expect(screen.getByTestId("order-line-qty-line-1").textContent).toBe("2"));

    expect(addCalls).toBe(1);
    expect(patchCalls).toBe(1);
    expect(screen.queryByTestId("order-line-line-2")).toBeNull();
    void fetchMock;
  });

  it("an item with a required modifier group blocks add until it's satisfied", async () => {
    const user = userEvent.setup();
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    await user.click(screen.getByTestId("item-tile-item-paneer"));
    const confirm = (await screen.findByTestId("modifier-sheet-confirm")) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // variant + required spice group both unsatisfied

    await user.click(screen.getByTestId("variant-chip-v-half"));
    expect(confirm.disabled).toBe(true); // spice group still unsatisfied

    await user.click(screen.getByTestId("modifier-chip-m-medium"));
    expect(confirm.disabled).toBe(false);
  });

  it("the order panel updates as lines are added, with variant name resolved from the menu", async () => {
    const user = userEvent.setup();
    const afterAdd = order({
      lines: [
        {
          id: "line-paneer",
          orderId: ORDER_ID,
          itemId: "item-paneer",
          variantId: "v-half",
          quantity: 1,
          unitPriceMinor: 34000,
          seatNumber: null,
          addedByStaffId: CURRENT_STAFF_ID,
          createdAt: new Date().toISOString(),
          modifiers: [{ id: "olm-1", modifierId: "m-medium", name: "Medium", priceMinor: 0 }],
        },
      ],
    });
    stubFetch((url) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines")) return jsonResponse(afterAdd);
      return jsonResponse(order());
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());
    expect(screen.getByTestId("order-panel-total").textContent).toBe("₹0");

    await user.click(screen.getByTestId("item-tile-item-paneer"));
    await user.click(screen.getByTestId("variant-chip-v-half"));
    await user.click(screen.getByTestId("modifier-chip-m-medium"));
    await user.click(screen.getByTestId("modifier-sheet-confirm"));

    await waitFor(() => expect(screen.getByTestId("order-panel-total").textContent).toBe("₹340"));
    expect(screen.queryByTestId("modifier-sheet")).toBeNull();
    expect(screen.queryByTestId("order-panel-empty")).toBeNull();
    expect(screen.getByText("Half", { exact: false })).toBeTruthy();
  });

  it("incrementing a line's quantity calls the update endpoint and reflects the new total", async () => {
    const user = userEvent.setup();
    const oneLine = order({
      lines: [
        {
          id: "line-naan",
          orderId: ORDER_ID,
          itemId: "item-naan",
          variantId: null,
          quantity: 1,
          unitPriceMinor: 14000,
          seatNumber: null,
          addedByStaffId: CURRENT_STAFF_ID,
          createdAt: new Date().toISOString(),
          modifiers: [],
        },
      ],
    });
    const twoLines = { ...oneLine, lines: [{ ...oneLine.lines[0], quantity: 2 }] };

    stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines/line-naan") && init?.method === "PATCH") return jsonResponse(twoLines);
      return jsonResponse(oneLine);
    });
    renderView();
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
          orderId: ORDER_ID,
          itemId: "item-naan",
          variantId: null,
          quantity: 1,
          unitPriceMinor: 14000,
          seatNumber: null,
          addedByStaffId: CURRENT_STAFF_ID,
          createdAt: new Date().toISOString(),
          modifiers: [],
        },
      ],
    });
    const emptied = { ...oneLine, lines: [] };

    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/lines/line-naan") && init?.method === "DELETE") return jsonResponse(emptied);
      return jsonResponse(oneLine);
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    await user.click(screen.getByTestId("order-line-decrement-line-naan"));

    await waitFor(() => expect(screen.getByTestId("order-panel-empty")).toBeTruthy());
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(true);
  });

  // --- Send-to-kitchen. Product decision (2026-09-02, restiq-web#120): seats
  // are optional metadata only now - they never gate sending, and this
  // screen no longer renders a "Split by seat" toggle or per-line seat rows.

  function lineFixture(overrides: Partial<RawOrder["lines"][number]> = {}): RawOrder["lines"][number] {
    return {
      id: "line-naan",
      orderId: ORDER_ID,
      itemId: "item-naan",
      variantId: null,
      quantity: 1,
      unitPriceMinor: 14000,
      seatNumber: null,
      addedByStaffId: CURRENT_STAFF_ID,
      createdAt: new Date().toISOString(),
      modifiers: [],
      ...overrides,
    };
  }

  it("does not render the split-by-seat toggle or any per-line seat row", async () => {
    const withUnseatedLine = order({ lines: [lineFixture()] });
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(withUnseatedLine)));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    expect(screen.queryByTestId("split-by-seat-toggle")).toBeNull();
    expect(screen.queryByTestId("order-line-seat-line-naan")).toBeNull();
    expect(screen.queryByTestId("order-line-seat-increment-line-naan")).toBeNull();
    expect(screen.queryByTestId("order-line-seat-decrement-line-naan")).toBeNull();
  });

  it("enables send to kitchen with an unseated line, and never shows a seat-gate message", async () => {
    const withUnseatedLine = order({ lines: [lineFixture()] });
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(withUnseatedLine)));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    const sendButton = screen.getByTestId("send-to-kitchen") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    expect(screen.queryByTestId("send-to-kitchen-blocked")).toBeNull();
  });

  it("sending to the kitchen succeeds for an order with unseated lines, gated on the real Order.status (not a fabricated firedAt timestamp)", async () => {
    const user = userEvent.setup();
    const withUnseatedLine = order({ lines: [lineFixture()] });
    const sent = { ...withUnseatedLine, status: "sent" as const };

    const fetchMock = stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/status") && init?.method === "PATCH") return jsonResponse(sent);
      return jsonResponse(withUnseatedLine);
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    const sendButton = screen.getByTestId("send-to-kitchen") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);

    await user.click(sendButton);

    await waitFor(() => expect(screen.getByTestId("send-to-kitchen").textContent).toBe("Sent to kitchen"));
    const statusCall = fetchMock.mock.calls.find(([url, init]) => (url as string).endsWith("/status") && (init as RequestInit | undefined)?.method === "PATCH");
    expect(JSON.parse((statusCall?.[1] as RequestInit).body as string)).toEqual({ status: "sent" });
    expect((screen.getByTestId("send-to-kitchen") as HTMLButtonElement).disabled).toBe(true);
  });

  it("surfaces a race-condition unseated_lines rejection from the backend as a plain inline error, not a reinstated gate", async () => {
    const user = userEvent.setup();
    const withUnseatedLine = order({ lines: [lineFixture()] });
    let statusCalls = 0;
    stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/status") && init?.method === "PATCH") {
        statusCalls += 1;
        return jsonResponse({ error: { message: "Every line must be seated before sending to the kitchen.", code: "unseated_lines" } }, 400);
      }
      return jsonResponse(withUnseatedLine);
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-line-line-naan")).toBeTruthy());

    await user.click(screen.getByTestId("send-to-kitchen"));

    await waitFor(() => expect(screen.getByTestId("order-taking-action-error").textContent).toContain("Every line must be seated"));
    expect(statusCalls).toBe(1);
    expect(screen.queryByTestId("send-to-kitchen-blocked")).toBeNull();
  });

  it("send to kitchen stays disabled for an order with no lines - existing empty-order behavior is unaffected", async () => {
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.queryByTestId("split-by-seat-toggle")).toBeNull();
    expect((screen.getByTestId("send-to-kitchen") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("send-to-kitchen-blocked")).toBeNull();
  });

  it("searching finds an item outside the active category tab", async () => {
    const user = userEvent.setup();
    stubFetch((url) => (url.includes("/menu") ? jsonResponse(MENU) : jsonResponse(order())));
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.queryByTestId("item-tile-item-naan")).toBeNull();
    await user.type(screen.getByTestId("menu-search"), "naan");
    expect(screen.getByTestId("item-tile-item-naan")).toBeTruthy();
    expect(screen.queryByTestId("item-tile-item-paneer")).toBeNull();
  });

describe("OrderTakingView - mistakes on a sent order (CU-15, CU-27)", () => {
  const sentLine = {
    id: "line-sent",
    orderId: ORDER_ID,
    itemId: "item-paneer",
    variantId: "v-half",
    quantity: 1,
    unitPriceMinor: 34000,
    seatNumber: null,
    addedByStaffId: CURRENT_STAFF_ID,
    addedByStaffName: "Me",
    note: "less spicy",
    sentToKitchen: true,
    createdAt: new Date().toISOString(),
    modifiers: [],
  };
  const newLine = { ...sentLine, id: "line-new", note: null, sentToKitchen: false };

  it("marks what the kitchen has, shows notes, lets an unsent line go and voids a sent one only with a manager PIN", async () => {
    const user = userEvent.setup();
    let voidBody: unknown = null;
    stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (url.endsWith("/void")) {
        voidBody = JSON.parse(String(init?.body));
        return jsonResponse(order({ status: "sent", lines: [newLine] }));
      }
      return jsonResponse(order({ status: "sent", lines: [sentLine, newLine] }));
    });
    renderView();
    await waitFor(() => expect(screen.getByTestId("order-taking-view")).toBeTruthy());

    expect(screen.getByTestId("order-line-note-line-sent").textContent).toBe("Note: less spicy");
    expect(screen.getByTestId("order-line-kitchen-state-line-sent").textContent).toBe("In kitchen");
    expect(screen.getByTestId("order-line-kitchen-state-line-new").textContent).toContain("not sent yet");
    // A bin only where it works: the unsent line has one, the sent line has Void instead.
    expect(screen.queryByTestId("order-line-remove-line-sent")).toBeNull();
    expect(screen.getByTestId("order-line-remove-line-new")).toBeTruthy();
    expect(screen.getByTestId("send-to-kitchen").textContent).toBe("Send 1 new item to kitchen");

    await user.click(screen.getByTestId("order-line-void-line-sent"));
    for (const digit of ["1", "2", "3", "4"]) await user.click(screen.getByTestId(`manager-pin-dialog-digit-${digit}`));
    await user.selectOptions(screen.getByTestId("manager-pin-dialog-reason-select"), "order-error");
    await user.click(screen.getByTestId("manager-pin-dialog-confirm"));

    await waitFor(() => expect(screen.queryByTestId("order-line-line-sent")).toBeNull());
    expect(voidBody).toEqual({ managerPin: "1234", reason: "Order entry error" });
  });

  it("discards an empty order and goes back to the table map (CU-27)", async () => {
    const user = userEvent.setup();
    let deleted = false;
    stubFetch((url, init) => {
      if (url.includes("/menu")) return jsonResponse(MENU);
      if (init?.method === "DELETE") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return jsonResponse(order());
    });
    renderView();
    await user.click(await screen.findByTestId("discard-order"));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/pos/table-map"));
    expect(deleted).toBe(true);
  });
});
});
