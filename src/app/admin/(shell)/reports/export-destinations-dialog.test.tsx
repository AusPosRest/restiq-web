import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportDestinationsDialog } from "./export-destinations-dialog";
import type { ExportDestinationView } from "./reports-state";

const DESTINATIONS: ExportDestinationView[] = [
  { key: "tally", name: "Tally", status: "not_connected" },
  { key: "xero", name: "Xero", status: "not_connected" },
  { key: "myob", name: "MYOB", status: "not_connected" },
  { key: "zoho", name: "Zoho Books", status: "not_connected" },
  { key: "quickbooks", name: "QuickBooks", status: "not_connected" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch() {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(DESTINATIONS)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExportDestinationsDialog", () => {
  it("renders nothing when closed, and doesn't fetch", () => {
    const fetchMock = stubFetch();
    render(<ExportDestinationsDialog open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("export-destinations-dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists every accounting destination as honestly not connected - no fake connected state", async () => {
    stubFetch();
    render(<ExportDestinationsDialog open onClose={() => {}} />);

    const dialog = await screen.findByTestId("export-destinations-dialog");
    expect(dialog).toBeTruthy();

    for (const destination of DESTINATIONS) {
      const row = await screen.findByTestId(`export-destination-${destination.key}`);
      expect(row.textContent).toContain(destination.name);
      expect(screen.getByTestId(`export-destination-${destination.key}-status`).textContent).toBe("Not connected");
    }
  });

  it("shows a retryable error panel when loading fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500)));
    vi.stubGlobal("fetch", fetchMock);
    render(<ExportDestinationsDialog open onClose={() => {}} />);

    await screen.findByTestId("export-destinations-load-error");
    await userEvent.click(screen.getByTestId("export-destinations-load-error-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("calls onClose when Done is clicked", async () => {
    stubFetch();
    const onClose = vi.fn();
    render(<ExportDestinationsDialog open onClose={onClose} />);
    await screen.findByTestId("export-destinations-dialog");

    await userEvent.click(screen.getByTestId("export-destinations-done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed (keyboard-operable, per EXPERIENCE.md)", async () => {
    stubFetch();
    const onClose = vi.fn();
    render(<ExportDestinationsDialog open onClose={onClose} />);
    await screen.findByTestId("export-destinations-dialog");

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
