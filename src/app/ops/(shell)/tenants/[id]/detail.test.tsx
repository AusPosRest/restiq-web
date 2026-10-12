// O5 Tenant Detail lifecycle actions (restiq-web#146): deactivate/reactivate
// post through the reason dialog like every other mutation here; delete adds
// the irreversible-checkbox guard and navigates away on success.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantDetail } from "../../api";
import { ToastProvider } from "../../toast";
import { TenantDetailPage } from "./detail";

const TENANT_ID = "0192dddd-0000-7000-8000-000000000004";
const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: TENANT_ID }),
  useRouter: () => ({ replace, push }),
  usePathname: () => `/ops/tenants/${TENANT_ID}`,
  useSearchParams: () => new URLSearchParams(),
}));

function tenantDetail(overrides: Partial<TenantDetail["tenant"]> = {}): TenantDetail {
  return {
    tenant: {
      id: TENANT_ID,
      name: "Bombay Bistro Group",
      registeredAddress: "12 MG Road, Mumbai",
      contactName: "Asha Rao",
      contactEmail: "asha@bombaybistro.example",
      contactPhone: "+91 98765 43210",
      country: "IN",
      status: "active",
      plan: "standard",
      billingPeriod: "monthly",
      testMode: false,
      liveSince: "2026-01-01T00:00:00.000Z",
      brandingTokens: {},
      region: "ap-south-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    },
    taxRegistrations: [],
    brands: [],
    outlets: [],
    rolesCount: 0,
    ownerInvite: null,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderPage(
  detail: TenantDetail,
  extraRoutes?: (url: string, init?: RequestInit) => Response | undefined,
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const extra = extraRoutes?.(url, init);
    if (extra) return Promise.resolve(extra);
    if (url.endsWith(`/ops/api/tenants/${TENANT_ID}`)) return Promise.resolve(jsonResponse(detail));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <ToastProvider>
      <TenantDetailPage />
    </ToastProvider>,
  );
  return fetchMock;
}

describe("TenantDetailPage lifecycle actions", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows Activate only for a provisioning tenant, alongside Delete", async () => {
    renderPage(tenantDetail({ status: "provisioning" }));
    await screen.findByTestId("tenant-detail");
    expect(screen.getByTestId("tenant-activate")).toBeTruthy();
    expect(screen.getByTestId("tenant-delete")).toBeTruthy();
    expect(screen.queryByTestId("tenant-deactivate")).toBeNull();
    expect(screen.queryByTestId("tenant-reactivate")).toBeNull();
  });

  it("shows Deactivate (not Reactivate) for an active tenant and posts the reason", async () => {
    const fetchMock = renderPage(tenantDetail({ status: "active" }), (url) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/deactivate`)) {
        return jsonResponse({ tenant: { id: TENANT_ID, status: "inactive" } });
      }
      return undefined;
    });
    await screen.findByTestId("tenant-detail");
    expect(screen.queryByTestId("tenant-reactivate")).toBeNull();
    expect(screen.queryByTestId("tenant-activate")).toBeNull();

    await userEvent.click(screen.getByTestId("tenant-deactivate"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Non-payment");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/deactivate`));
      expect(call).toBeTruthy();
    });
    const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/deactivate`))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ reason: "Non-payment" });
    expect(await screen.findByTestId("toast-success")).toBeTruthy();
  });

  it("shows Reactivate (not Deactivate) for an inactive tenant and posts the reason", async () => {
    const fetchMock = renderPage(tenantDetail({ status: "inactive" }), (url) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/reactivate`)) {
        return jsonResponse({ tenant: { id: TENANT_ID, status: "active" } });
      }
      return undefined;
    });
    await screen.findByTestId("tenant-detail");
    expect(screen.queryByTestId("tenant-deactivate")).toBeNull();

    await userEvent.click(screen.getByTestId("tenant-reactivate"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Payment received");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/reactivate`));
      expect(call).toBeTruthy();
    });
    expect(await screen.findByTestId("toast-success")).toBeTruthy();
  });

  it("deactivate: a 409 conflict shows the backend message in an error toast and leaves the page as-is", async () => {
    renderPage(tenantDetail({ status: "active" }), (url) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/deactivate`)) {
        return jsonResponse(
          { error: { code: "tenant_has_open_activity", message: "This tenant has open orders or bills." } },
          409,
        );
      }
      return undefined;
    });
    await screen.findByTestId("tenant-detail");
    await userEvent.click(screen.getByTestId("tenant-deactivate"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Attempting deactivate");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("This tenant has open orders or bills.");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("tenant-detail")).toBeTruthy();
  });

  it("delete: requires the irreversible checkbox before enabling submit, then deletes and navigates to the directory", async () => {
    const fetchMock = renderPage(tenantDetail({ status: "active" }), (url, init) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}`) && init?.method === "DELETE") {
        return jsonResponse({ tenant: { id: TENANT_ID, status: "inactive" } });
      }
      return undefined;
    });
    await screen.findByTestId("tenant-detail");

    await userEvent.click(screen.getByTestId("tenant-delete"));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("cannot be undone");

    await userEvent.type(screen.getByTestId("confirm-reason"), "Tenant requested closure");
    expect((screen.getByTestId("confirm-submit") as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByTestId("confirm-checkbox"));
    expect((screen.getByTestId("confirm-submit") as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/ops/tenants"));
    const call = fetchMock.mock.calls.find(
      ([url, init]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}`) && (init as RequestInit | undefined)?.method === "DELETE",
    )!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ reason: "Tenant requested closure" });
  });

  it("delete: a 409 conflict shows the backend message and does not navigate away", async () => {
    renderPage(tenantDetail({ status: "active" }), (url, init) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}`) && init?.method === "DELETE") {
        return jsonResponse(
          { error: { code: "tenant_has_open_activity", message: "Cannot delete: open bills exist." } },
          409,
        );
      }
      return undefined;
    });
    await screen.findByTestId("tenant-detail");

    await userEvent.click(screen.getByTestId("tenant-delete"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Trying to delete");
    await userEvent.click(screen.getByTestId("confirm-checkbox"));
    await userEvent.click(screen.getByTestId("confirm-submit"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("Cannot delete: open bills exist.");
    expect(push).not.toHaveBeenCalled();
  });

  it("does not call the API when the confirm dialog is cancelled", async () => {
    const fetchMock = renderPage(tenantDetail({ status: "active" }));
    await screen.findByTestId("tenant-detail");
    await userEvent.click(screen.getByTestId("tenant-deactivate"));
    await userEvent.click(screen.getByTestId("confirm-cancel"));
    expect(fetchMock.mock.calls.some(([url]) => (url as string).includes("/deactivate"))).toBe(false);
  });

  it("shows the GST rate on Overview when registered, and 'Not applicable' otherwise", async () => {
    const detail = tenantDetail({ status: "active" });
    detail.taxRegistrations = [
      {
        registrationType: "gstin",
        registrationNumber: "29ABCDE1234F1Z5",
        legalEntityName: "Bombay Bistro Group",
        taxProfile: "India GST - CGST/SGST split",
        fssaiLicense: null,
        compositionScheme: false,
        gstRegistered: true,
        gstRatePercent: 5,
      },
    ];
    renderPage(detail);
    await screen.findByTestId("tenant-detail");
    expect(screen.getByTestId("overview-gst").textContent).toContain("Applicable · 5%");
  });

  it("shows 'Not applicable' when the tenant has no GST registration", async () => {
    renderPage(tenantDetail({ status: "active" }));
    await screen.findByTestId("tenant-detail");
    expect(screen.getByTestId("overview-gst").textContent).toContain("Not applicable");
  });

  // restiq-backend#213: Test / Live mode - badge, confirmation with reason + checkbox, and the API's refusal surfaced.
  describe("Test / Live mode", () => {
    it("badges a Test tenant and switches it to Live after the confirmation", async () => {
      const fetchMock = renderPage(tenantDetail({ testMode: true, liveSince: null }), (url) => {
        if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/mode`)) return jsonResponse({ tenant: { id: TENANT_ID, testMode: false, liveSince: "2026-10-11T00:00:00.000Z" } });
        return undefined;
      });
      await screen.findByTestId("tenant-detail");
      expect(screen.getByTestId("tenant-detail-test-badge").textContent).toBe("Test");

      await userEvent.click(screen.getByTestId("tenant-mode-switch"));
      expect(screen.getByTestId("confirm-dialog").textContent).toContain("Simulated card and QR payments stop working");
      await userEvent.type(screen.getByTestId("confirm-reason"), "Signed up");
      expect((screen.getByTestId("confirm-submit") as HTMLButtonElement).disabled).toBe(true);
      await userEvent.click(screen.getByTestId("confirm-checkbox"));
      await userEvent.click(screen.getByTestId("confirm-submit"));

      await waitFor(() => {
        expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/mode`))).toBe(true);
      });
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/mode`))!;
      expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ mode: "live", reason: "Signed up" });
      expect(await screen.findByTestId("toast-success")).toBeTruthy();
    });

    it("shows no badge for a Live tenant and explains why it can't go back to Test", async () => {
      renderPage(tenantDetail(), (url) => {
        if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/mode`)) {
          return jsonResponse({ error: { code: "tenant_has_live_sales", message: "This tenant has real sales since it went Live, so it cannot go back to Test mode" } }, 409);
        }
        return undefined;
      });
      await screen.findByTestId("tenant-detail");
      expect(screen.queryByTestId("tenant-detail-test-badge")).toBeNull();
      await userEvent.click(screen.getByTestId("tenant-mode-switch"));
      await userEvent.type(screen.getByTestId("confirm-reason"), "Demo");
      await userEvent.click(screen.getByTestId("confirm-checkbox"));
      await userEvent.click(screen.getByTestId("confirm-submit"));
      expect((await screen.findByTestId("toast-error")).textContent).toContain("real sales");
    });
  });
});
