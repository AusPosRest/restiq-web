import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../toast";
import { TenantDetail } from "../../api";
import { BrandingTab } from "./branding-tab";

const TENANT_ID = "0192bbbb-0000-7000-8000-000000000002";

// Only the fields BrandingTab actually reads are filled in - same
// minimal-fixture style as capabilities-tab.test.tsx.
function buildDetail(brandingTokens: Record<string, string>): TenantDetail {
  return {
    tenant: {
      id: TENANT_ID,
      name: "Spice Route",
      registeredAddress: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      country: "IN",
      status: "active",
      plan: "starter",
      billingPeriod: "monthly",
      brandingTokens,
      region: "in-1",
      createdAt: new Date().toISOString(),
    },
    taxRegistrations: [],
    brands: [],
    outlets: [],
    rolesCount: 0,
    ownerInvite: null,
    capabilities: [],
  };
}

function renderTab(brandingTokens: Record<string, string> = {}, onMutated = vi.fn()) {
  return render(
    <ToastProvider>
      <BrandingTab detail={buildDetail(brandingTokens)} onMutated={onMutated} />
    </ToastProvider>,
  );
}

async function submitWithReason(reason = "Correcting the tenant's branding") {
  await userEvent.click(screen.getByTestId("branding-save"));
  await userEvent.type(screen.getByTestId("confirm-reason"), reason);
  await userEvent.click(screen.getByTestId("confirm-submit"));
}

// input[type=color] and input[type=range] aren't reliably driven by
// userEvent's pointer/keyboard model in jsdom - a direct change event is the
// escape hatch the owner console's own branding-editor.test.tsx uses too.
function fireEventChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("BrandingTab", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders populated from the tenant's stored branding tokens", () => {
    renderTab({ primaryColor: "#123456", font: "Inter", cornerRadiusPx: "20", receiptFooter: "Thanks!" });

    expect((screen.getByTestId("branding-color-primaryColor-hex") as HTMLInputElement).value).toBe("#123456");
    expect((screen.getByTestId("branding-font") as HTMLInputElement).value).toBe("Inter");
    expect(screen.getByTestId("branding-corner-radius-value").textContent).toBe("20px");
    expect((screen.getByTestId("branding-receipt-footer") as HTMLTextAreaElement).value).toBe("Thanks!");
  });

  it("shows an empty text field with a placeholder for an unset value", () => {
    renderTab({});
    expect((screen.getByTestId("branding-font") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("branding-font")).toHaveProperty("placeholder", "e.g. Inter");
  });

  it("keeps the color picker and its hex text field in sync", () => {
    renderTab({});
    const hex = screen.getByTestId("branding-color-primaryColor-hex") as HTMLInputElement;
    const picker = screen.getByTestId("branding-color-primaryColor-picker") as HTMLInputElement;

    fireEventChange(hex, "#00ff00");
    expect(picker.value).toBe("#00ff00");

    fireEventChange(picker, "#ff0000");
    expect(hex.value).toBe("#ff0000");
  });

  it("disables Save while a color field holds an invalid hex value", async () => {
    renderTab({});
    const hex = screen.getByTestId("branding-color-primaryColor-hex") as HTMLInputElement;

    await userEvent.type(hex, "z");
    expect(screen.getByTestId("branding-save")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("branding-color-primaryColor-error")).toBeTruthy();
  });

  it("clamps the corner-radius slider to 0-64", () => {
    renderTab({});
    const slider = screen.getByTestId("branding-corner-radius");

    fireEventChange(slider, "999");
    expect(screen.getByTestId("branding-corner-radius-value").textContent).toBe("64px");

    fireEventChange(slider, "-10");
    expect(screen.getByTestId("branding-corner-radius-value").textContent).toBe("0px");
  });

  it("PUTs only the changed fields merged onto the tenant's full token map, and toasts success", async () => {
    const onMutated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ brandingTokens: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderTab({ primaryColor: "#111111", customThing: "keep-me" }, onMutated);

    await userEvent.type(screen.getByTestId("branding-receipt-footer"), "Thanks!");
    await submitWithReason("Fixing the footer");

    await waitFor(() => expect(onMutated).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/ops/api/tenants/${TENANT_ID}/branding`);
    const body = JSON.parse(init.body as string) as { tokens: Record<string, string>; reason: string };
    expect(body.reason).toBe("Fixing the footer");
    expect(body.tokens).toEqual({ primaryColor: "#111111", customThing: "keep-me", receiptFooter: "Thanks!" });
    expect((await screen.findByTestId("toast-success")).textContent).toContain("Branding updated");
  });

  it("shows an error toast and keeps the draft editable when the save fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "validation_failed", message: "Bad token" } }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderTab({});

    await userEvent.type(screen.getByTestId("branding-receipt-footer"), "Thanks!");
    await submitWithReason();

    const toast = await screen.findByTestId("toast-error");
    expect(toast.textContent).toContain("Bad token");
    expect((screen.getByTestId("branding-receipt-footer") as HTMLTextAreaElement).value).toBe("Thanks!");
  });
});
