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
    priceMinor: 18000,
    currency: "INR",
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
      categories={CATEGORIES}
      modifierGroupCatalog={[]}
      allergenCatalog={[]}
      outlets={[]}
      selectedOutletId={null}
      defaultCategoryId="tandoor"
      currency="INR"
      onClose={onClose}
      onSaved={onSaved}
      onModifierGroupCreated={vi.fn()}
      onAllergenCreated={vi.fn()}
      {...props}
    />,
  );
  return { onClose, onSaved };
}

describe("ItemDrawer delete (issue #248)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("asks for confirmation, then deletes through DELETE and hands the item back", async () => {
    const fetchMock = stubFetch({ onPost: (url) => (url.endsWith("/admin/api/menu/items/item-1") ? new Response(null, { status: 204 }) : undefined) });
    const onDeleted = vi.fn();
    renderDrawer({ onDeleted });

    await userEvent.click(screen.getByTestId("item-delete"));
    expect(screen.getByTestId("item-delete-confirm").textContent).toContain("Paneer Tikka");
    await userEvent.click(screen.getByTestId("item-delete-confirm-button"));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(expect.objectContaining({ id: "item-1" })));
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(String(call?.[0])).toBe("/admin/api/menu/items/item-1");
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const fetchMock = stubFetch();
    renderDrawer({ onDeleted: vi.fn() });

    await userEvent.click(screen.getByTestId("item-delete"));
    await userEvent.click(screen.getByTestId("item-delete-cancel"));
    expect(screen.queryByTestId("item-delete-confirm")).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("does not offer Delete while creating a new item", () => {
    stubFetch();
    renderDrawer({ item: null });
    expect(screen.queryByTestId("item-delete")).toBeNull();
  });
});

describe("ItemDrawer open/close and field editing", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("uploads a photo resized in the browser, and removes it (issue #218)", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 960, height: 640, close: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AAAA");
    const patches: unknown[] = [];
    stubFetch({
      onPost: (url, body) => {
        if (!url.endsWith("/menu/items/item-1")) return undefined;
        patches.push(body);
        return jsonResponse(item({ photoUrl: (body as { photoUrl: string | null }).photoUrl }));
      },
    });
    renderDrawer();

    await userEvent.upload(screen.getByTestId("item-photo-input"), new File(["x"], "dosa.png", { type: "image/png" }));
    expect((await screen.findByTestId("item-photo-preview")).getAttribute("src")).toBe("data:image/jpeg;base64,AAAA");
    expect(toDataUrl).toHaveBeenCalledWith("image/jpeg", 0.8);

    await userEvent.click(screen.getByTestId("item-photo-remove"));
    await waitFor(() => expect(screen.queryByTestId("item-photo-preview")).toBeNull());
    expect(patches).toEqual([{ photoUrl: "data:image/jpeg;base64,AAAA" }, { photoUrl: null }]);
    vi.restoreAllMocks();
  });

  it("does not render when closed", () => {
    stubFetch();
    render(
      <ItemDrawer
        open={false}
        item={null}
        categories={CATEGORIES}
        modifierGroupCatalog={[]}
        allergenCatalog={[]}
          outlets={[]}
        selectedOutletId={null}
        defaultCategoryId="tandoor"
        currency="INR"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onModifierGroupCreated={vi.fn()}
        onAllergenCreated={vi.fn()}
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

  it("scrolls only the form body, keeping Save pinned outside the scroll area (issue #266)", () => {
    stubFetch();
    renderDrawer();

    const body = screen.getByTestId("item-drawer-body");
    expect(body.className).toContain("scrollbar-visible");
    expect(body.className).toContain("min-h-0");
    expect(screen.getByTestId("item-drawer").className).not.toContain("overflow-y-auto");
  });

  it("updates a field's value as the owner types", async () => {
    stubFetch();
    renderDrawer();
    const input = screen.getByTestId("item-name-input");
    await userEvent.clear(input);
    await userEvent.type(input, "Malai Tikka");
    expect((input as HTMLInputElement).value).toBe("Malai Tikka");
  });

  it("says the item needs a name instead of saving it without one", async () => {
    stubFetch();
    const { onSaved } = renderDrawer();
    const input = screen.getByTestId("item-name-input");
    await userEvent.clear(input);
    await userEvent.click(screen.getByTestId("item-save"));
    expect(screen.getByTestId("item-name-error").textContent).toBe("Name the item.");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows no errors on a fresh Add Item form until a field is left or Add is tried (PE-13)", async () => {
    stubFetch();
    renderDrawer({ item: null });
    expect(screen.queryByTestId("item-name-error")).toBeNull();
    expect(screen.queryByTestId("item-short-name-error")).toBeNull();
    expect(screen.getByTestId("item-save").textContent).toBe("Add item");
  });

  it("fills the kitchen ticket name from the item name until it is edited (CU-1)", async () => {
    stubFetch();
    renderDrawer({ item: null });
    await userEvent.type(screen.getByTestId("item-name-input"), "Garden Salad");
    expect((screen.getByTestId("item-short-name-input") as HTMLInputElement).value).toBe("Garden Salad");
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
    const { onSaved, onClose } = renderDrawer();

    const input = screen.getByTestId("item-name-input");
    await userEvent.clear(input);
    await userEvent.type(input, "Malai Tikka");
    await userEvent.click(screen.getByTestId("item-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(onClose).toHaveBeenCalled();
    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
    expect(patchCall?.[0]).toBe("/admin/api/menu/items/item-1");
    expect(JSON.parse((patchCall?.[1] as RequestInit).body as string)).toEqual({ name: "Malai Tikka", shortName: "Paneer Tikka", categoryId: "tandoor", vegMarker: null });
  });

  it("says a new item needs a price, and that a negative one is not allowed (PE-13)", async () => {
    const fetchMock = stubFetch();
    renderDrawer({ item: null });
    await userEvent.type(screen.getByTestId("item-name-input"), "Malai Tikka");
    await userEvent.click(screen.getByTestId("item-save"));
    expect(screen.getByTestId("item-create-price-error").textContent).toBe("Enter a price.");

    await userEvent.type(screen.getByTestId("item-create-price"), "-5");
    expect(screen.getByTestId("item-create-price-error").textContent).toBe("Price can't be negative.");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("creates an item with Half/Full portions and their prices in one go (CU-1)", async () => {
    const created = item({ id: "item-3", name: "Biryani", priceMinor: null, variants: [{ id: "v1", name: "Half", sortOrder: 0, priceMinor: 16900 }] });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST" && String(input) === "/admin/api/menu/items") return Promise.resolve(jsonResponse(created, 201));
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onSaved } = renderDrawer({ item: null });

    await userEvent.type(screen.getByTestId("item-name-input"), "Biryani");
    await userEvent.click(screen.getByTestId("item-create-add-variant"));
    await userEvent.click(screen.getByTestId("item-create-add-variant"));
    await userEvent.type(screen.getByTestId("item-create-variant-0-name"), "Half");
    await userEvent.type(screen.getByTestId("item-create-variant-0-price"), "169");
    await userEvent.type(screen.getByTestId("item-create-variant-1-name"), "Full");
    await userEvent.type(screen.getByTestId("item-create-variant-1-price"), "289.50");
    await userEvent.click(screen.getByTestId("item-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1); // no separate base price for an item sold by portion
    expect(JSON.parse(posts[0]?.[1]?.body as string).variants).toEqual([
      { name: "Half", priceMinor: 16900, currency: "INR" },
      { name: "Full", priceMinor: 28950, currency: "INR" },
    ]);
  });

  it("creates a new item through the create endpoint, then posts its price with the price-change dialog's client (issue #330)", async () => {
    const created = item({ id: "item-2", name: "Malai Tikka" });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url === "/admin/api/menu/items") return Promise.resolve(jsonResponse(created, 201));
      if (method === "POST" && url === "/admin/api/menu/items/item-2/prices") {
        const body = JSON.parse(init?.body as string);
        return Promise.resolve(
          jsonResponse({ id: "p1", itemId: "item-2", variantId: null, channel: "dine_in", outletId: null, currency: "INR", createdAt: "2026-08-24T00:00:00.000Z", ...body }, 201),
        );
      }
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled: " + method + " " + url } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onSaved } = renderDrawer({ item: null });

    await userEvent.type(screen.getByTestId("item-name-input"), "Malai Tikka");
    await userEvent.type(screen.getByTestId("item-create-price"), "250");
    await userEvent.click(screen.getByTestId("item-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...created, priceMinor: 25000, currency: "INR" }));
    const [itemCall, priceCall] = fetchMock.mock.calls as [string, RequestInit][];
    expect(itemCall[0]).toBe("/admin/api/menu/items");
    expect(itemCall[1].method).toBe("POST");
    expect(priceCall[0]).toBe("/admin/api/menu/items/item-2/prices");
    expect(JSON.parse(priceCall[1].body as string)).toEqual({ priceMinor: 25000, currency: "INR", reason: "Initial price" });
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

  it("shows the item's one current price from the item itself, with no price request (#272, SE-20)", async () => {
    const fetchMock = stubFetch();
    renderDrawer({ item: item({ priceMinor: 28950 }) });
    expect(screen.getByTestId("item-base-price-current").textContent).toBe("₹289.50");
    expect(screen.queryByTestId("item-base-price-pending")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/price?"))).toBe(false);
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
    expect(priceCalls).toHaveLength(1); // one price for every channel; RESTIQ has no delivery price (#272)
    const [, init] = priceCalls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toMatchObject({ effectiveAt: `${futureYmd}T00:00:00.000Z`, reason: "Menu refresh" });
    expect(sentBody).not.toHaveProperty("channel"); // no channel = every channel, so QR and takeaway are priced too
  });

  it("says a reason is needed instead of greying out the save button (CU-2)", async () => {
    const fetchMock = stubFetch();
    renderDrawer();
    await userEvent.click(screen.getByTestId("item-base-price-change"));
    expect(screen.getByTestId("price-change-submit")).toHaveProperty("disabled", false);
    await userEvent.click(screen.getByTestId("price-change-submit"));
    expect(screen.getByTestId("price-change-reason-error").textContent).toBe("Add a reason for this price change.");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});

describe("ItemDrawer variants", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("adds a priced variant and keeps the current price on sale as a named portion (issue #333, PE-15)", async () => {
    const updated = item({
      variants: [
        { id: "v0", name: "Full", sortOrder: 0, priceMinor: 18000 },
        { id: "v1", name: "Half", sortOrder: 1, priceMinor: 11000 },
      ],
    });
    const fetchMock = stubFetch({
      onPost: (url, body) => (url === "/admin/api/menu/items/item-1/variants" && (body as { name: string }).name === "Half" ? jsonResponse(updated, 201) : undefined),
    });
    const { onSaved, onClose } = renderDrawer();

    await userEvent.clear(screen.getByTestId("item-base-portion-name"));
    await userEvent.type(screen.getByTestId("item-base-portion-name"), "Full");
    await userEvent.type(screen.getByTestId("item-new-variant-name"), "Half");
    await userEvent.type(screen.getByTestId("item-new-variant-price"), "110");
    await userEvent.click(screen.getByTestId("item-add-variant"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    const postCall = fetchMock.mock.calls.find(([url]) => url === "/admin/api/menu/items/item-1/variants");
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ name: "Half", priceMinor: 11000, basePortionName: "Full", currency: "INR" });
    expect(onClose).not.toHaveBeenCalled();
    // CU-1: once portions exist, the base price is no longer shown.
    expect(screen.queryByTestId("item-base-price-current")).toBeNull();
    expect(screen.getByTestId("item-variant-v0-price-current").textContent).toBe("₹180");
  });

  it("asks for the new variant's price instead of creating it at nothing (PE-13)", async () => {
    const fetchMock = stubFetch();
    renderDrawer();
    await userEvent.type(screen.getByTestId("item-new-variant-name"), "Half");
    await userEvent.click(screen.getByTestId("item-add-variant"));
    expect(screen.getByTestId("item-new-variant-price-error").textContent).toBe("Enter a price.");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("flags a portion with no price, which the till and QR menu can't sell (CU-23)", () => {
    stubFetch();
    renderDrawer({ item: item({ priceMinor: null, variants: [{ id: "v1", name: "Half", sortOrder: 0, priceMinor: null }] }) });
    expect(screen.getByTestId("item-unsellable-note").textContent).toContain("isn't on the till or QR menu");
    expect(screen.getByTestId("item-variant-v1-price-current").textContent).toBe("No price yet");
  });
});

describe("ItemDrawer kitchen station (PE-21)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("lists the outlet's stations and routes the item to the chosen one", async () => {
    const routed = item({ stationId: "st-bar" });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/admin/api/outlets/o1/floor-plan") {
        return Promise.resolve(
          jsonResponse({
            floors: [],
            printers: [],
            stations: [
              { id: "st-hot", name: "Hot Kitchen" },
              { id: "st-bar", name: "Bar" },
            ],
          }),
        );
      }
      if (init?.method === "PATCH" && url === "/admin/api/menu/items/item-1/station") return Promise.resolve(jsonResponse(routed));
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onSaved } = renderDrawer({ outlets: [{ id: "o1", name: "Main", address: "", type: "dine_in", timezone: "Asia/Kolkata" }], selectedOutletId: "o1" });

    const select = await screen.findByTestId("item-station-select");
    await userEvent.selectOptions(select, "st-bar");

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(routed));
    const patch = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/station"));
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ stationId: "st-bar" });
  });
});
