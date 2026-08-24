import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { CapabilitiesEditor } from "./capabilities-editor";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Outlet shape matches restiq-backend's real GET /admin/v1/outlets response.
const OUTLETS = [{ id: "outlet-1", name: "MG Road", address: "12 MG Road", type: "dine_in", timezone: "Asia/Kolkata" }];
// Backend only ever returns rows explicitly toggled at least once.
const CAPABILITIES = [{ key: "qr_ordering", enabled: true }];

function stubFetch({ outlets = OUTLETS, capabilities = CAPABILITIES, toggleOk = true }: { outlets?: unknown; capabilities?: unknown; toggleOk?: boolean } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    // Order matters: "/admin/api/outlets" is a substring of the per-outlet
    // capabilities URL too, so the more specific "/capabilities" checks must
    // run first or every capabilities request would wrongly match the plain
    // outlets list instead.
    if (url.includes("/capabilities/") && method === "PATCH") {
      if (!toggleOk) return Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500));
      const key = url.split("/capabilities/")[1];
      const body = JSON.parse(String(init?.body)) as { enabled: boolean };
      return Promise.resolve(jsonResponse({ key, enabled: body.enabled }));
    }
    if (url.includes("/capabilities") && method === "GET") return Promise.resolve(jsonResponse(capabilities));
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse(outlets));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderEditor() {
  return render(
    <ToastProvider>
      <OutletProvider>
        <CapabilitiesEditor />
      </OutletProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CapabilitiesEditor", () => {
  it("shows an informational empty state when the tenant has no outlets", async () => {
    stubFetch({ outlets: [] });
    renderEditor();
    expect(await screen.findByTestId("capabilities-no-outlets")).toBeTruthy();
  });

  it("lists the selected outlet's capabilities with friendly labels", async () => {
    stubFetch();
    renderEditor();

    expect((await screen.findByTestId("capability-row-qr_ordering")).textContent).toContain("QR Ordering");
    expect(screen.getByTestId("capability-row-kiosk").textContent).toContain("Kiosk Mode");
    expect(screen.getByTestId("capability-toggle-qr_ordering")).toHaveProperty("ariaChecked", "true");
    expect(screen.getByTestId("capability-toggle-kiosk")).toHaveProperty("ariaChecked", "false");
  });

  it("renders every known capability as off for a fresh outlet with zero recorded rows", async () => {
    stubFetch({ capabilities: [] });
    renderEditor();

    expect(await screen.findByTestId("capability-toggle-qr_ordering")).toHaveProperty("ariaChecked", "false");
    expect(screen.getByTestId("capability-toggle-kiosk")).toHaveProperty("ariaChecked", "false");
    expect(screen.getByTestId("capability-toggle-token_queue")).toHaveProperty("ariaChecked", "false");
  });

  it("toggles optimistically and calls the PATCH endpoint", async () => {
    const fetchMock = stubFetch();
    renderEditor();
    const toggle = await screen.findByTestId("capability-toggle-kiosk");

    await userEvent.click(toggle);
    expect(toggle).toHaveProperty("ariaChecked", "true");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/outlets/outlet-1/capabilities/kiosk"), expect.objectContaining({ method: "PATCH" })),
    );
  });

  it("rolls back and toasts an error when the toggle call fails", async () => {
    stubFetch({ toggleOk: false });
    renderEditor();
    const toggle = await screen.findByTestId("capability-toggle-kiosk");

    await userEvent.click(toggle);
    await screen.findByTestId("toast-error");
    await waitFor(() => expect(toggle).toHaveProperty("ariaChecked", "false"));
    expect(screen.getByTestId("toast-error").textContent).toContain("Couldn't update Kiosk Mode");
  });
});
