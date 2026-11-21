// restiq-web#449 service mode: where the handoff form goes, and the button's behaviour in a clickable row.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { OpenAsStoreButton, serviceHandoffUrl } from "./open-as-store";

describe("serviceHandoffUrl", () => {
  it("uses the restaurant's own address when the console is on the base domain", () => {
    expect(serviceHandoffUrl("bayleaf", "niftypos.com.au", "niftypos.com.au")).toBe("https://bayleaf.niftypos.com.au/admin/auth/service");
    expect(serviceHandoffUrl("bayleaf", "dev.niftypos.com.au", "ops.dev.niftypos.com.au")).toBe("https://bayleaf.dev.niftypos.com.au/admin/auth/service");
  });

  it("falls back to the same-origin path for a bad or missing slug", () => {
    expect(serviceHandoffUrl(null, "niftypos.com.au", "niftypos.com.au")).toBe("/admin/auth/service");
    expect(serviceHandoffUrl("Bad_Slug", "niftypos.com.au", "niftypos.com.au")).toBe("/admin/auth/service");
    expect(serviceHandoffUrl("evil.com/x", "niftypos.com.au", "niftypos.com.au")).toBe("/admin/auth/service");
  });

  it("falls back when the base domain is missing or invalid", () => {
    expect(serviceHandoffUrl("bayleaf", undefined, "niftypos.com.au")).toBe("/admin/auth/service");
    expect(serviceHandoffUrl("bayleaf", "", "niftypos.com.au")).toBe("/admin/auth/service");
    expect(serviceHandoffUrl("bayleaf", "evil.com/x", "niftypos.com.au")).toBe("/admin/auth/service");
  });

  it("falls back when the console is served off the base domain", () => {
    expect(serviceHandoffUrl("bayleaf", "niftypos.com.au", "localhost")).toBe("/admin/auth/service");
    expect(serviceHandoffUrl("bayleaf", "niftypos.com.au", "restiq-web.workers.dev")).toBe("/admin/auth/service");
    expect(serviceHandoffUrl("bayleaf", "niftypos.com.au", "notniftypos.com.au")).toBe("/admin/auth/service");
  });
});

function renderInRow(status: string, onRowClick = vi.fn()) {
  render(
    <ToastProvider>
      <table>
        <tbody>
          <tr onClick={onRowClick} onKeyDown={onRowClick}>
            <td>
              <OpenAsStoreButton tenantId="t-1" tenantName="Bay Leaf" status={status} variant="outline" />
            </td>
          </tr>
        </tbody>
      </table>
    </ToastProvider>,
  );
  return onRowClick;
}

describe("OpenAsStoreButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
  });

  it("is disabled for an inactive tenant", () => {
    renderInRow("inactive");
    const button = screen.getByTestId("open-as-store-t-1") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe("Reactivate this tenant to open it");
  });

  it("opens the confirm dialog without navigating the row", async () => {
    const onRow = renderInRow("active");
    await userEvent.click(screen.getByTestId("open-as-store-t-1"));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("Open Bay Leaf as store");
    await userEvent.type(screen.getByTestId("confirm-reason"), "Menu help");
    expect(onRow).not.toHaveBeenCalled();
  });

  it("posts the handoff code in a form body to the new tab", async () => {
    const tab = { opener: {} as unknown, close: vi.fn() };
    const open = vi.fn().mockReturnValue(tab);
    vi.stubGlobal("open", open);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "hc_secret", slug: "bayleaf", expiresInSeconds: 60 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const submitted: HTMLFormElement[] = [];
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (this: HTMLFormElement) {
      submitted.push(this);
    });

    renderInRow("active");
    await userEvent.click(screen.getByTestId("open-as-store-t-1"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Menu help");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(submitted).toHaveLength(1));
    const [, name] = open.mock.calls[0] as [string, string];
    expect(tab.opener).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/ops/api/tenants/t-1/service-session", expect.objectContaining({ method: "POST", body: JSON.stringify({ reason: "Menu help" }) }));
    const form = submitted[0];
    expect(form.method).toBe("post");
    expect(form.target).toBe(name);
    expect(new URL(form.action).pathname).toBe("/admin/auth/service");
    expect(form.action).not.toContain("hc_secret");
    expect((form.elements.namedItem("code") as HTMLInputElement).value).toBe("hc_secret");
    expect(form.isConnected).toBe(false);
  });

  it("opens the store in this tab when the browser blocks the new one", async () => {
    vi.stubGlobal("open", vi.fn().mockReturnValue(null));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "hc_secret", slug: null, expiresInSeconds: 60 }), { status: 200 })));
    const submitted: HTMLFormElement[] = [];
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (this: HTMLFormElement) {
      submitted.push(this);
    });

    renderInRow("active");
    await userEvent.click(screen.getByTestId("open-as-store-t-1"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Menu help");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0].target).toBe("_self");
    expect((submitted[0].elements.namedItem("code") as HTMLInputElement).value).toBe("hc_secret");
  });

  it("closes the blank tab and explains an inactive tenant", async () => {
    const tab = { opener: {} as unknown, close: vi.fn() };
    vi.stubGlobal("open", vi.fn().mockReturnValue(tab));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "tenant_inactive", message: "inactive" } }), { status: 409 })));

    renderInRow("active");
    await userEvent.click(screen.getByTestId("open-as-store-t-1"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Menu help");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    expect(await screen.findByText("This tenant is inactive. Reactivate it first.")).toBeTruthy();
    expect(tab.close).toHaveBeenCalled();
  });
});
