import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { TaxRegistrationEditor } from "./tax-registration-editor";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Matches restiq-backend#108's actual GET admin/v1/tax-registration shape.
const TAX_REGISTRATION = {
  country: "IN",
  registrationType: "gstin",
  registrationNumber: "27ABCDE1234F1Z5",
  legalEntityName: "Acme Foods Pvt Ltd",
  taxProfile: "restaurant",
  fssaiLicense: "12345678901234",
  compositionScheme: false,
};

function stubFetch({ get = TAX_REGISTRATION, putStatus = 200 }: { get?: unknown; putStatus?: number } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/admin/api/tax-registration") && method === "GET") return Promise.resolve(jsonResponse(get));
    if (url.includes("/admin/api/tax-registration") && method === "PUT") {
      if (putStatus === 409) {
        return Promise.resolve(jsonResponse({ error: { code: "conflict", message: "Already used by another tenant" } }, 409));
      }
      if (putStatus !== 200) {
        return Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, putStatus));
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({ ...(get as Record<string, unknown>), ...body }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderEditor() {
  return render(
    <ToastProvider>
      <TaxRegistrationEditor />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TaxRegistrationEditor", () => {
  it("shows a loading skeleton, then the form seeded from the backend's record", async () => {
    stubFetch();
    renderEditor();
    expect(screen.getByTestId("tax-registration-loading")).toBeTruthy();

    await screen.findByTestId("tax-registration-form");
    expect(screen.getByTestId("tax-registration-country").textContent).toBe("IN");
    expect(screen.getByTestId("tax-registration-type").textContent).toBe("GSTIN");
    expect((screen.getByTestId("tax-registration-number") as HTMLInputElement).value).toBe("27ABCDE1234F1Z5");
    expect((screen.getByTestId("tax-registration-legal-entity-name") as HTMLInputElement).value).toBe("Acme Foods Pvt Ltd");
    expect((screen.getByTestId("tax-registration-composition-scheme") as HTMLInputElement).checked).toBe(false);
  });

  it("labels the registration number field ABN when registrationType is abn", async () => {
    stubFetch({ get: { ...TAX_REGISTRATION, country: "AU", registrationType: "abn", registrationNumber: "51824753556" } });
    renderEditor();

    await screen.findByTestId("tax-registration-form");
    expect(screen.getByTestId("tax-registration-type").textContent).toBe("ABN");
    expect(screen.getByLabelText("ABN Number")).toBeTruthy();
  });

  it("shows a retryable error panel when the load fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500)));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor();

    await screen.findByTestId("tax-registration-load-error");
    await userEvent.click(screen.getByTestId("tax-registration-load-error-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps Save disabled until something changes, then saves via a merge-PUT and toasts success", async () => {
    const fetchMock = stubFetch();
    renderEditor();
    await screen.findByTestId("tax-registration-form");

    const save = screen.getByTestId("tax-registration-save");
    expect(save).toHaveProperty("disabled", true);

    const legalName = screen.getByTestId("tax-registration-legal-entity-name");
    await userEvent.clear(legalName);
    await userEvent.type(legalName, "Acme Foods LLP");
    expect(save).toHaveProperty("disabled", false);

    await userEvent.click(save);
    await waitFor(() => expect(save).toHaveProperty("disabled", true));
    expect((await screen.findByTestId("toast-success")).textContent).toContain("Tax registration saved");

    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT");
    const sentBody = JSON.parse((putCall?.[1] as RequestInit).body as string) as Record<string, unknown>;
    // country/registrationType are read-only and must never be sent back.
    expect(sentBody).not.toHaveProperty("country");
    expect(sentBody).not.toHaveProperty("registrationType");
    expect(sentBody).toMatchObject({ registrationNumber: "27ABCDE1234F1Z5", legalEntityName: "Acme Foods LLP" });
  });

  it("surfaces a 409 as a specific inline error on the registration number field, not a generic toast", async () => {
    stubFetch({ putStatus: 409 });
    renderEditor();
    await screen.findByTestId("tax-registration-form");

    const numberInput = screen.getByTestId("tax-registration-number");
    await userEvent.type(numberInput, "9");
    await userEvent.click(screen.getByTestId("tax-registration-save"));

    expect((await screen.findByTestId("tax-registration-number-conflict-error")).textContent).toBe("Already used by another tenant");
    expect(screen.queryByTestId("toast-error")).toBeNull();
    // Save stays enabled (still dirty) so the owner can fix the number and retry.
    expect(screen.getByTestId("tax-registration-save")).toHaveProperty("disabled", false);
  });

  it("rolls back to a generic error toast with retry on a non-conflict save failure", async () => {
    stubFetch({ putStatus: 500 });
    renderEditor();
    await screen.findByTestId("tax-registration-form");

    await userEvent.type(screen.getByTestId("tax-registration-legal-entity-name"), "!");
    await userEvent.click(screen.getByTestId("tax-registration-save"));

    expect((await screen.findByTestId("toast-error")).textContent).toContain("Couldn't save your tax registration");
    expect(screen.queryByTestId("tax-registration-number-conflict-error")).toBeNull();
  });

  it("requires a non-empty registration number and blocks Save", async () => {
    stubFetch();
    renderEditor();
    await screen.findByTestId("tax-registration-form");

    const numberInput = screen.getByTestId("tax-registration-number");
    await userEvent.clear(numberInput);

    expect(await screen.findByTestId("tax-registration-number-required-error")).toBeTruthy();
    expect(screen.getByTestId("tax-registration-save")).toHaveProperty("disabled", true);
  });
});
