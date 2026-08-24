// Capability toggles are optimistic with rollback + failure toast (O5 note).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../toast";
import { CapabilitiesTab } from "./capabilities-tab";

const TENANT_ID = "0192bbbb-0000-7000-8000-000000000002";
const CAPABILITIES = [
  { key: "reservations", enabled: false },
  { key: "kot_kds", enabled: true },
];

function renderTab() {
  return render(
    <ToastProvider>
      <CapabilitiesTab tenantId={TENANT_ID} capabilities={CAPABILITIES} />
    </ToastProvider>,
  );
}

async function toggleWithReason(key: string, reason: string) {
  await userEvent.click(screen.getByTestId(`capability-toggle-${key}`));
  await userEvent.type(screen.getByTestId("confirm-reason"), reason);
  await userEvent.click(screen.getByTestId("confirm-submit"));
}

describe("CapabilitiesTab", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("asks for a reason, then flips optimistically and keeps the flip on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ capability: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderTab();

    const toggle = screen.getByTestId("capability-toggle-reservations");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await toggleWithReason("reservations", "Pilot for this tenant");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/ops/api/tenants/${TENANT_ID}/capabilities/reservations`);
    expect(JSON.parse(init.body as string)).toEqual({ enabled: true, reason: "Pilot for this tenant" });
    expect(screen.queryByTestId("toast-error")).toBeNull();
  });

  it("rolls the toggle back and shows a retryable failure toast when the write fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "validation_failed", message: "No can do" } }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderTab();

    const toggle = screen.getByTestId("capability-toggle-kot_kds");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await toggleWithReason("kot_kds", "Turning it off");
    // Optimistic flip happens first, then rolls back when the API rejects.
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    const toast = await screen.findByTestId("toast-error");
    expect(toast.textContent).toContain("No can do");
    expect(screen.getByTestId("toast-retry")).toBeTruthy();
  });

  it("does not call the API at all when the confirm dialog is cancelled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderTab();

    await userEvent.click(screen.getByTestId("capability-toggle-reservations"));
    await userEvent.click(screen.getByTestId("confirm-cancel"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("capability-toggle-reservations").getAttribute("aria-checked")).toBe("false");
  });
});
