import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemDrawer } from "./item-drawer";
import { CategoryView, ItemView, ModifierGroupView } from "./menu-state";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const CATEGORIES: CategoryView[] = [
  { id: "tandoor", name: "Tandoor", sortOrder: 0, itemCount: 7 },
  { id: "mains", name: "Mains", sortOrder: 1, itemCount: 12 },
];

function item(overrides: Partial<ItemView> = {}): ItemView {
  return {
    id: "item-1",
    name: "Paneer Tikka",
    shortName: "Paneer Tikka",
    categoryId: "tandoor",
    available: true,
    variants: [],
    modifierGroups: [],
    allergens: [],
    ...overrides,
  };
}

function currentPriceResponse(itemId: string, channel: string, priceMinor: number, variantId: string | null = null) {
  return jsonResponse({ itemId, variantId, channel, outletId: null, priceMinor, currency: "INR", effectiveAt: "2026-08-01T00:00:00.000Z" });
}

function stubFetch(overrides: { onPost?: (url: string, body: unknown) => Response | undefined } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url.includes("/price?")) {
      const channel = new URL(url, "http://x").searchParams.get("channel");
      return Promise.resolve(currentPriceResponse("item-1", channel ?? "dine_in", channel === "delivery" ? 20000 : 18000));
    }
    if (overrides.onPost) {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      const custom = overrides.onPost(url, body);
      if (custom) return Promise.resolve(custom);
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled: " + method + " " + url } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDrawer(props: Partial<React.ComponentProps<typeof ItemDrawer>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <ItemDrawer
      open
      item={item()}
      allItems={[item()]}
      categories={CATEGORIES}
      modifierGroupCatalog={[]}
      allergenCatalog={[]}
      comboCatalog={[]}
      outlets={[]}
      selectedOutletId={null}
      defaultCategoryId="tandoor"
      currency="INR"
      onClose={onClose}
      onSaved={onSaved}
      onModifierGroupCreated={vi.fn()}
      onAllergenCreated={vi.fn()}
      onComboCreated={vi.fn()}
      {...props}
    />,
  );
  return { onClose, onSaved };
}

describe("ItemDrawer open/close and field editing", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("does not render when closed", () => {
    stubFetch();
    render(
      <ItemDrawer
        open={false}
        item={null}
        allItems={[]}
        categories={CATEGORIES}
        modifierGroupCatalog={[]}
        allergenCatalog={[]}
        comboCatalog={[]}
        outlets={[]}
        selectedOutletId={null}
        defaultCategoryId="tandoor"
        currency="INR"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onModifierGroupCreated={vi.fn()}
        onAllergenCreated={vi.fn()}
        onComboCreated={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("item-drawer")).toBeNull();
  });

  it("renders 'Edit Item' for an existing item, pre-filled with its fields", () => {
    stubFetch();
    renderDrawer();
    expect(screen.getByTestId("item-drawer")).toBeTruthy();
    expect(screen.getByText("Edit Item")).toBeTruthy();
    expect((screen.getByTestId("item-name-input") as HTMLInputElement).value).toBe("Paneer Tikka");
  });

  it("renders 'Add Item' with blank fields for a new item", () => {
    stubFetch();
    renderDrawer({ item: null });
    expect(screen.getByText("Add Item")).toBeTruthy();
    expect((screen.getByTestId("item-name-input") as HTMLInputElement).value).toBe("");
  });

  it("closes via the close button", async () => {
    stubFetch();
    const { onClose } = renderDrawer();
    await userEvent.click(screen.getByTestId("item-drawer-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("updates a field's value as the owner types", async () => {
    stubFetch();
    renderDrawer();
    const input = screen.getByTestId("item-name-input");
    await userEvent.clear(input);
    await userEvent.type(input, "Malai Tikka");
    expect((input as HTMLInputElement).value).toBe("Malai Tikka");
  });

  it("disables Save Changes until the item has a name", async () => {
    stubFetch();
    renderDrawer();
    const input = screen.getByTestId("item-name-input");
    await userEvent.clear(input);
    expect(screen.getByTestId("item-save")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("item-name-error").textContent).toBe("Name the item.");
  });

  it("saves routine field edits through the update endpoint (name/shortName/categoryId only)", async () => {
    const updated = item({ name: "Malai Tikka" });
    const fetchMock = stubFetch({ onPost: () => undefined });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "PATCH" && url === "/admin/api/menu/items/item-1") return Promise.resolve(jsonResponse(updated));
      if (method === "GET" && url.includes("/price?")) return Promise.resolve(currentPriceResponse("item-1", "dine_in", 18000));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const { onSaved } = renderDrawer();

    const input = screen.getByTestId("item-name-input");
    await userEvent.clear(input);
    await userEvent.type(input, "Malai Tikka");
    await userEvent.click(screen.getByTestId("item-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
    expect(patchCall?.[0]).toBe("/admin/api/menu/items/item-1");
    expect(JSON.parse((patchCall?.[1] as RequestInit).body as string)).toEqual({ name: "Malai Tikka", shortName: "Paneer Tikka", categoryId: "tandoor" });
  });

  it("creates a new item through the create endpoint when there is no item yet", async () => {
    const created = item({ id: "item-2", name: "Malai Tikka" });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { onSaved } = renderDrawer({ item: null });

    await userEvent.type(screen.getByTestId("item-name-input"), "Malai Tikka");
    await userEvent.type(screen.getByTestId("item-short-name-input"), "Malai Tikka");
    await userEvent.click(screen.getByTestId("item-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/admin/api/menu/items");
    expect(init.method).toBe("POST");
  });
});

describe("ItemDrawer modifier group validation messaging", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("shows a message when a new group has no options yet, and disables save", async () => {
    stubFetch();
    renderDrawer();
    await userEvent.click(screen.getByTestId("item-add-modifier-group"));

    expect(screen.getByTestId("new-modifier-group-options-error").textContent).toBe("Add at least one option.");
    expect(screen.getByTestId("new-modifier-group-save")).toHaveProperty("disabled", true);
  });

  it("flags a maximum greater than the number of options with a specific message", async () => {
    stubFetch();
    renderDrawer();
    await userEvent.click(screen.getByTestId("item-add-modifier-group"));

    await userEvent.type(screen.getByTestId("new-modifier-group-name"), "Add-ons");
    await userEvent.type(screen.getByTestId("new-modifier-group-option-name"), "Extra cheese");
    await userEvent.click(screen.getByTestId("new-modifier-group-add-option"));
    const maxInput = screen.getByTestId("new-modifier-group-max");
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, "3");

    expect(screen.getByTestId("new-modifier-group-max-error").textContent).toBe("Maximum can't exceed the number of options (1).");
  });

  it("clears the validation message and enables save once the group is filled in correctly", async () => {
    stubFetch();
    renderDrawer();
    await userEvent.click(screen.getByTestId("item-add-modifier-group"));

    await userEvent.type(screen.getByTestId("new-modifier-group-name"), "Spice Level");
    await userEvent.type(screen.getByTestId("new-modifier-group-option-name"), "Mild");
    await userEvent.click(screen.getByTestId("new-modifier-group-add-option"));

    expect(screen.queryByTestId("new-modifier-group-options-error")).toBeNull();
    expect(screen.getByTestId("new-modifier-group-save")).toHaveProperty("disabled", false);
  });

  it("creates and attaches a group on save", async () => {
    const createdGroup: ModifierGroupView = {
      id: "group-1",
      name: "Spice Level",
      minSelections: 1,
      maxSelections: 1,
      modifiers: [{ id: "m1", name: "Mild", priceMinor: 0 }],
    };
    const fetchMock = stubFetch({
      onPost: (url) => {
        if (url === "/admin/api/menu/modifier-groups") return jsonResponse(createdGroup, 201);
        if (url === "/admin/api/menu/items/item-1/modifier-groups") return jsonResponse(item({ modifierGroups: [createdGroup] }));
        return undefined;
      },
    });
    const onModifierGroupCreated = vi.fn();
    renderDrawer({ onModifierGroupCreated });

    await userEvent.click(screen.getByTestId("item-add-modifier-group"));
    await userEvent.type(screen.getByTestId("new-modifier-group-name"), "Spice Level");
    await userEvent.type(screen.getByTestId("new-modifier-group-option-name"), "Mild");
    await userEvent.click(screen.getByTestId("new-modifier-group-add-option"));
    await userEvent.click(screen.getByTestId("new-modifier-group-save"));

    await waitFor(() => expect(onModifierGroupCreated).toHaveBeenCalledWith(createdGroup));
    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT");
    expect(putCall?.[0]).toBe("/admin/api/menu/items/item-1/modifier-groups");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ modifierGroupIds: ["group-1"] });
  });
});

describe("ItemDrawer price - current vs pending distinction", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("fetches and shows the current dine-in and delivery price", async () => {
    stubFetch();
    renderDrawer();
    await waitFor(() => expect(screen.getByTestId("item-base-price-current").textContent).toContain("₹180"));
    expect(screen.getByTestId("item-base-price-current").textContent).toContain("₹200");
    expect(screen.queryByTestId("item-base-price-pending")).toBeNull();
  });

  it("opens the price-change dialog from 'Change price', schedules a future change with a reason, and shows it as pending (distinct from current)", async () => {
    // A pending price only reads as pending while effectiveAt is in the
    // future, so the date must be computed, never hardcoded (issue #89).
    const futureDate = new Date(Date.now() + 7 * 86400000);
    const futureYmd = futureDate.toISOString().slice(0, 10);
    const futureDay = String(futureDate.getUTCDate());
    const futureMonth = futureDate.toLocaleString("en", { month: "short", timeZone: "UTC" });
    const fetchMock = stubFetch({
      onPost: (url, body) => {
        if (url === "/admin/api/menu/items/item-1/prices") {
          const b = body as { channel: string; priceMinor: number; effectiveAt?: string };
          return jsonResponse({ id: "p1", itemId: "item-1", variantId: null, ...b, currency: "INR", createdAt: "2026-08-24T00:00:00.000Z" }, 201);
        }
        return undefined;
      },
    });
    renderDrawer();
    await waitFor(() => expect(screen.getByTestId("item-base-price-current").textContent).toContain("₹180"));

    await userEvent.click(screen.getByTestId("item-base-price-change"));
    expect(screen.getByTestId("price-change-dialog")).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Schedule for a date"));
    await userEvent.type(screen.getByTestId("price-change-date"), futureYmd);
    await userEvent.type(screen.getByTestId("price-change-reason"), "Menu refresh");
    await userEvent.click(screen.getByTestId("price-change-submit"));

    await waitFor(() => expect(screen.getByTestId("item-base-price-pending")).toBeTruthy());
    // Current price line is untouched - nothing was overwritten in place.
    expect(screen.getByTestId("item-base-price-current").textContent).toContain("₹180");
    expect(screen.getByTestId("item-base-price-pending").textContent).toMatch(
      new RegExp(`${futureDay} ${futureMonth}|${futureMonth} ${futureDay}`),
    );

    const priceCalls = fetchMock.mock.calls.filter(([url]) => url === "/admin/api/menu/items/item-1/prices");
    expect(priceCalls).toHaveLength(2); // one per channel (dine_in, delivery)
    const [, init] = priceCalls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toMatchObject({ channel: "dine_in", effectiveAt: `${futureYmd}T00:00:00.000Z`, reason: "Menu refresh" });
  });

  it("requires a reason before the price-change submit is enabled", async () => {
    stubFetch();
    renderDrawer();
    await waitFor(() => screen.getByTestId("item-base-price-current"));
    await userEvent.click(screen.getByTestId("item-base-price-change"));
    expect(screen.getByTestId("price-change-submit")).toHaveProperty("disabled", true);
  });
});

describe("ItemDrawer variants", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("adds a variant through the dedicated variant endpoint", async () => {
    const updated = item({ variants: [{ id: "v1", name: "Half", sortOrder: 0 }] });
    const fetchMock = stubFetch({
      onPost: (url, body) => (url === "/admin/api/menu/items/item-1/variants" && (body as { name: string }).name === "Half" ? jsonResponse(updated, 201) : undefined),
    });
    const { onSaved } = renderDrawer();
    await waitFor(() => screen.getByTestId("item-base-price-current"));

    await userEvent.type(screen.getByTestId("item-new-variant-name"), "Half");
    await userEvent.click(screen.getByTestId("item-add-variant"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    const postCall = fetchMock.mock.calls.find(([url]) => url === "/admin/api/menu/items/item-1/variants");
    expect(postCall).toBeTruthy();
  });
});
