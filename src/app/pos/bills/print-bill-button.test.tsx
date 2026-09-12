// Issue #208: one tap posts the bill to the spool and the button reports the
// outcome in place, then resets so a reprint is possible.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrintBillButton } from "./print-bill-button";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PrintBillButton", () => {
  it("posts to bills/:id/print and shows Sent to printer, then resets to the label", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() => Promise.resolve(jsonResponse({ id: "job-1" }, 201)));
    vi.stubGlobal("fetch", fetchMock);
    render(<PrintBillButton billId="bill-7" label="Print bill" testId="print-bill" />);

    await userEvent.click(screen.getByTestId("print-bill"));
    await waitFor(() => expect(screen.getByTestId("print-bill").textContent).toBe("Sent to printer"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/pos/api/bills/bill-7/print");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    await waitFor(() => expect(screen.getByTestId("print-bill").textContent).toBe("Print bill"), { timeout: 3_000 });
  });

  it("shows Couldn't send when the spool rejects and disables the button only while sending", async () => {
    let resolve: (value: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    render(<PrintBillButton billId="bill-7" label="Print bill" testId="print-bill" />);

    await userEvent.click(screen.getByTestId("print-bill"));
    expect(screen.getByTestId("print-bill").textContent).toBe("Sending…");
    expect((screen.getByTestId("print-bill") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve(jsonResponse({ error: { code: "not_found", message: "no bill" } }, 404)));
    await waitFor(() => expect(screen.getByTestId("print-bill").textContent).toBe("Couldn't send"));
    expect((screen.getByTestId("print-bill") as HTMLButtonElement).disabled).toBe(false);
  });
});
