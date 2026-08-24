import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "./outlet-context";
import { OutletSwitcher } from "./outlet-switcher";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Shape matches restiq-backend's actual GET /admin/v1/outlets response
// (src/admin/outlets/outlets.dtos.ts): { id, name, address, type, timezone }.
const OUTLETS = [
  { id: "outlet-1", name: "MG Road", address: "12 MG Road", type: "dine_in", timezone: "Asia/Kolkata" },
  { id: "outlet-2", name: "Koramangala", address: "5th Block", type: "qsr", timezone: "Asia/Kolkata" },
];

function stubFetch(outlets: unknown = OUTLETS) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse(outlets));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OutletSwitcher", () => {
  it("stays hidden while there are no outlets", async () => {
    stubFetch([]);
    render(
      <OutletProvider>
        <OutletSwitcher />
      </OutletProvider>,
    );
    await waitFor(() => expect(screen.queryByTestId("outlet-switcher")).toBeNull());
  });

  it("populates from the real GET /admin/v1/outlets response", async () => {
    stubFetch();
    render(
      <OutletProvider>
        <OutletSwitcher />
      </OutletProvider>,
    );

    const select = (await screen.findByTestId("outlet-switcher")) as HTMLSelectElement;
    expect(screen.getByText("MG Road")).toBeTruthy();
    expect(screen.getByText("Koramangala")).toBeTruthy();
    expect(select.value).toBe("outlet-1");
  });

  it("persists the selected outlet across remounts within the session", async () => {
    stubFetch();
    const { unmount } = render(
      <OutletProvider>
        <OutletSwitcher />
      </OutletProvider>,
    );
    const select = (await screen.findByTestId("outlet-switcher")) as HTMLSelectElement;
    await userEvent.selectOptions(select, "outlet-2");
    expect(select.value).toBe("outlet-2");
    unmount();

    render(
      <OutletProvider>
        <OutletSwitcher />
      </OutletProvider>,
    );
    const reselect = (await screen.findByTestId("outlet-switcher")) as HTMLSelectElement;
    await waitFor(() => expect(reselect.value).toBe("outlet-2"));
  });
});
