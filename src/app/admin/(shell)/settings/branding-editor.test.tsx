import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { BrandingEditor } from "./branding-editor";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Matches restiq-backend's actual all-null response for a fresh tenant
// (src/admin/branding/branding.dtos.ts's BrandingView).
const ALL_NULL_BRANDING = {
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  surfaceColor: null,
  font: null,
  cornerRadiusPx: null,
  logoUrl: null,
  receiptHeader: null,
  receiptFooter: null,
};

function stubFetch({ get = ALL_NULL_BRANDING, saveOk = true }: { get?: unknown; saveOk?: boolean } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/admin/api/branding") && method === "GET") return Promise.resolve(jsonResponse(get));
    if (url.includes("/admin/api/branding") && method === "PUT") {
      if (!saveOk) return Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500));
      const body = JSON.parse(String(init?.body));
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderEditor() {
  return render(
    <ToastProvider>
      <BrandingEditor />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BrandingEditor", () => {
  it("shows a loading skeleton, then the form seeded from a fresh tenant's all-null branding", async () => {
    stubFetch();
    renderEditor();
    expect(screen.getByTestId("branding-loading")).toBeTruthy();

    await screen.findByTestId("branding-form");
    expect((screen.getByTestId("branding-color-primaryColor") as HTMLInputElement).value).toBe("#f59e0b");
    expect((screen.getByTestId("branding-font") as HTMLSelectElement).value).toBe("Hanken Grotesk");
    expect(screen.getByTestId("branding-corner-radius-value").textContent).toBe("8px");
  });

  it("shows a retryable error panel when the load fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500)));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor();

    await screen.findByTestId("branding-load-error");
    await userEvent.click(screen.getByTestId("branding-load-error-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("updates the live receipt preview as tokens change, before saving", async () => {
    stubFetch();
    renderEditor();
    await screen.findByTestId("branding-form");

    expect(screen.queryByTestId("receipt-preview-header")).toBeNull();
    const header = screen.getByTestId("branding-receipt-header");
    await userEvent.type(header, "GSTIN 27ABCDE1234F1Z5");
    expect((await screen.findByTestId("receipt-preview-header")).textContent).toBe("GSTIN 27ABCDE1234F1Z5");

    const footer = screen.getByTestId("branding-receipt-footer");
    await userEvent.type(footer, "Thank you for visiting!");
    expect((await screen.findByTestId("receipt-preview-footer")).textContent).toBe("Thank you for visiting!");

    const radius = screen.getByTestId("branding-corner-radius");
    fireEventChange(radius, "20");
    expect(screen.getByTestId("branding-corner-radius-value").textContent).toBe("20px");
    expect(screen.getByTestId("receipt-preview").style.borderRadius).toBe("20px");
  });

  it("keeps Save disabled until something actually changes, then saves the flat token shape and toasts success", async () => {
    const fetchMock = stubFetch();
    renderEditor();
    await screen.findByTestId("branding-form");

    const save = screen.getByTestId("branding-save");
    expect(save).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByTestId("branding-receipt-footer"), "Thanks!");
    expect(save).toHaveProperty("disabled", false);

    await userEvent.click(save);
    await waitFor(() => expect(save).toHaveProperty("disabled", true));
    expect((await screen.findByTestId("toast-success")).textContent).toContain("reach every device within 5 minutes");

    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT");
    const sentBody = JSON.parse((putCall?.[1] as RequestInit).body as string) as Record<string, unknown>;
    expect(sentBody).toMatchObject({ primaryColor: "#F59E0B", receiptFooter: "Thanks!" });
  });

  it("rolls back to an error toast with retry when saving fails", async () => {
    stubFetch({ saveOk: false });
    renderEditor();
    await screen.findByTestId("branding-form");

    await userEvent.type(screen.getByTestId("branding-receipt-footer"), "Thanks!");
    await userEvent.click(screen.getByTestId("branding-save"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("Couldn't save your branding");
    // Save stays enabled (still dirty) so the owner can retry.
    expect(screen.getByTestId("branding-save")).toHaveProperty("disabled", false);
  });

  it("rejects a logo file that isn't an accepted type", async () => {
    stubFetch();
    renderEditor();
    await screen.findByTestId("branding-form");

    // userEvent.upload honors the input's `accept` attribute and silently
    // drops a non-matching file before firing change (mirroring real browser
    // file-picker filtering) - a wrong-type file has to be forced in via a
    // raw change event to exercise the component's own validation instead.
    const input = screen.getByTestId("branding-logo-input") as HTMLInputElement;
    const badFile = new File(["x"], "logo.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [badFile], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect((await screen.findByTestId("branding-logo-error")).textContent).toContain("SVG or PNG");
  });

  it("previews a picked logo file without putting it in the saved draft (backend caps logoUrl at 2048 chars)", async () => {
    stubFetch();
    renderEditor();
    await screen.findByTestId("branding-form");

    const input = screen.getByTestId("branding-logo-input") as HTMLInputElement;
    const goodFile = new File(["<svg></svg>"], "logo.svg", { type: "image/svg+xml" });
    await userEvent.upload(input, goodFile);

    const logo = await screen.findByTestId("receipt-preview-logo");
    expect((logo as HTMLImageElement).src).toContain("data:");
    // The picked file only ever previews - it never becomes the saved Logo URL value.
    expect((screen.getByTestId("branding-logo-url") as HTMLInputElement).value).toBe("");
  });

  it("blocks Save with an inline error when a pasted Logo URL exceeds the backend's 2048-char cap", async () => {
    stubFetch();
    renderEditor();
    await screen.findByTestId("branding-form");

    const urlInput = screen.getByTestId("branding-logo-url") as HTMLInputElement;
    fireEventChange(urlInput, `https://cdn.example.com/${"a".repeat(2100)}.png`);

    expect(await screen.findByTestId("branding-logo-url-error")).toBeTruthy();
    expect(screen.getByTestId("branding-save")).toHaveProperty("disabled", true);
  });
});

// input[type=range] and input[type=color] aren't reliably driven by
// userEvent's pointer/keyboard model in jsdom - a direct change event is the
// standard escape hatch for these control types (matches how price change
// tests in this app interact with input[type=date]).
function fireEventChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
