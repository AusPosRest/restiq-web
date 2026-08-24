import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { GenerateCodeDialog } from "./generate-code-dialog";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDialog(onGenerated = vi.fn(), onClose = vi.fn()) {
  render(
    <ToastProvider>
      <GenerateCodeDialog open onClose={onClose} outletId="outlet-1" onGenerated={onGenerated} />
    </ToastProvider>,
  );
  return { onGenerated, onClose };
}

describe("GenerateCodeDialog", () => {
  it("generates a code for the selected device type and hands it back", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ code: "R7K-4PD", deviceType: "pos", expiresAt: "2026-08-24T12:15:00.000Z" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { onGenerated } = renderDialog();

    await userEvent.selectOptions(screen.getByTestId("generate-code-type"), "kds");
    await userEvent.click(screen.getByTestId("generate-code-submit"));

    expect(await screen.findByTestId("device-code-chip-value")).toHaveProperty("textContent", "R7K-4PD");
    expect(onGenerated).toHaveBeenCalledWith({ code: "R7K-4PD", deviceType: "pos", expiresAt: "2026-08-24T12:15:00.000Z" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/outlets/outlet-1/devices/enrolment-codes"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ deviceType: "kds" }) }),
    );
  });

  it("toasts an error and stays open when generation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "server_error", message: "Could not generate a code." } }, 500))),
    );
    renderDialog();

    await userEvent.click(screen.getByTestId("generate-code-submit"));

    expect(await screen.findByTestId("toast-error")).toBeTruthy();
    expect(screen.queryByTestId("device-code-chip-value")).toBeNull();
  });

  it("closes when the close button is clicked", async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByTestId("generate-code-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
