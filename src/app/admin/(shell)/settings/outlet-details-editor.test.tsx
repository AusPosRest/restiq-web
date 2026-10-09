import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { OutletDetailsEditor } from "./outlet-details-editor";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Outlet shape matches restiq-backend's real GET /admin/v1/outlets response.
const OUTLETS = [{ id: "outlet-1", name: "MG Road", address: "12 MG Road", type: "dine_in", timezone: "Asia/Kolkata" }];

function stubFetch({ outlets = OUTLETS, patchStatus = 200 }: { outlets?: unknown; patchStatus?: number } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/admin/api/outlets/outlet-1") && method === "PATCH") {
      if (patchStatus !== 200) return Promise.resolve(jsonResponse({ error: { code: "validation_failed", message: "Name can't be blank" } }, patchStatus));
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const base = (outlets as Array<Record<string, unknown>>)[0];
      return Promise.resolve(jsonResponse({ ...base, ...body }));
    }
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
        <OutletDetailsEditor />
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

describe("OutletDetailsEditor", () => {
  it("shows an informational empty state when the tenant has no outlets", async () => {
    stubFetch({ outlets: [] });
    renderEditor();
    expect(await screen.findByTestId("outlet-details-no-outlets")).toBeTruthy();
  });

  it("renders the selected outlet's current name, address and timezone, with type read-only", async () => {
    stubFetch();
    renderEditor();

    await screen.findByTestId("outlet-details-form");
    expect((screen.getByTestId("outlet-details-name") as HTMLInputElement).value).toBe("MG Road");
    expect((screen.getByTestId("outlet-details-address") as HTMLTextAreaElement).value).toBe("12 MG Road");
    expect((screen.getByTestId("outlet-details-timezone") as HTMLSelectElement).value).toBe("Asia/Kolkata");
    expect(screen.getByTestId("outlet-details-type").textContent).toBe("Dine-in");
    expect(screen.getByTestId("outlet-details-save")).toHaveProperty("disabled", true);
  });

  it("sends only the changed fields in the PATCH and shows a success toast", async () => {
    const fetchMock = stubFetch();
    renderEditor();
    await screen.findByTestId("outlet-details-form");

    const nameInput = screen.getByTestId("outlet-details-name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Indiranagar");
    expect(screen.getByTestId("outlet-details-save")).toHaveProperty("disabled", false);

    await userEvent.click(screen.getByTestId("outlet-details-save"));
    await waitFor(() => expect(screen.getByTestId("outlet-details-save")).toHaveProperty("disabled", true));
    expect((await screen.findByTestId("toast-success")).textContent).toContain("Outlet details saved");

    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
    const sentBody = JSON.parse((patchCall?.[1] as RequestInit).body as string) as Record<string, unknown>;
    expect(sentBody).toEqual({ name: "Indiranagar" });
  });

  it("shows the server error inline instead of a toast", async () => {
    stubFetch({ patchStatus: 400 });
    renderEditor();
    await screen.findByTestId("outlet-details-form");

    const nameInput = screen.getByTestId("outlet-details-name");
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByTestId("outlet-details-save"));

    expect((await screen.findByTestId("outlet-details-error")).textContent).toBe("Name can't be blank");
    expect(screen.queryByTestId("toast-error")).toBeNull();
    expect(screen.getByTestId("outlet-details-save")).toHaveProperty("disabled", false);
  });
});
