import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { TopItems } from "./top-items";
import type { TopItemsResponse } from "./top-items-state";

const OUTLETS = [{ id: "outlet-1", name: "Indiranagar", address: "100 Ft Road", type: "dine_in", timezone: "Asia/Kolkata" }];
// Today in Asia/Kolkata is 2026-09-03 - same fixed clock as payments.test.tsx.
const SYSTEM_TIME = "2026-09-03T10:00:00.000Z";
const DEFAULT_FROM_ISO = "2026-09-02T18:30:00.000Z";

const RESPONSE: TopItemsResponse = {
  currency: "INR",
  items: [
    { id: "biryani", variantId: "half", name: "Biryani", portionName: "Half", quantity: 12, salesMinor: 240000 },
    { id: "dosa", variantId: null, name: "Masala Dosa", portionName: null, quantity: 8, salesMinor: 96000 },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(topItems: () => Response = () => jsonResponse(RESPONSE)) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse(OUTLETS));
    if (url.includes("/reports/top-items/export")) {
      return Promise.resolve(new Response("rank,item\n1,Biryani", { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="top-items.csv"' } }));
    }
    if (url.includes("/reports/top-items")) return Promise.resolve(topItems());
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderTopItems() {
  return render(
    <ToastProvider>
      <OutletProvider>
        <TopItems />
      </OutletProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(SYSTEM_TIME));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("TopItems", () => {
  it("loads today's range and renders ranked rows with portion and money", async () => {
    const fetchMock = stubFetch();
    renderTopItems();

    const first = await screen.findByTestId("top-items-row-1");
    expect(first.textContent).toContain("Biryani (Half)");
    expect(first.textContent).toContain("12");
    expect(first.textContent).toContain("₹2,400.00");
    expect(screen.getByTestId("top-items-row-2").textContent).toContain("Masala Dosa");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/reports/top-items?outletId=outlet-1&from=${encodeURIComponent(DEFAULT_FROM_ISO)}`), expect.anything());
  });

  it("refetches when the date filter changes", async () => {
    const fetchMock = stubFetch();
    renderTopItems();
    await screen.findByTestId("top-items-row-1");

    fireEvent.change(screen.getByTestId("top-items-filter-from"), { target: { value: "2026-09-01" } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`from=${encodeURIComponent("2026-08-31T18:30:00.000Z")}`), expect.anything());
    });
  });

  it("exports the CSV for the same filters", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock-url"), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderTopItems();
    await screen.findByTestId("top-items-row-1");

    await userEvent.click(screen.getByTestId("top-items-export"));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/reports/top-items/export?outletId=outlet-1&from=${encodeURIComponent(DEFAULT_FROM_ISO)}`));
    expect((await screen.findByTestId("toast-success")).textContent).toContain("top-items.csv");
    clickSpy.mockRestore();
  });

  it("shows an empty state when nothing sold in range", async () => {
    stubFetch(() => jsonResponse({ currency: "INR", items: [] }));
    renderTopItems();
    expect(await screen.findByTestId("top-items-empty")).toBeTruthy();
    expect(screen.queryByTestId("top-items-table")).toBeNull();
  });

  it("shows a retryable error panel on failure", async () => {
    const fetchMock = stubFetch(() => jsonResponse({ error: { code: "error", message: "nope" } }, 500));
    renderTopItems();
    await screen.findByTestId("top-items-load-error");
    const before = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByTestId("top-items-load-error-retry"));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });
});
