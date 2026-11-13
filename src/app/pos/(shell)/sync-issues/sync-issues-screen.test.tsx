import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncIssuesScreen } from "./sync-issues-screen";

const ITEMS = [
  { opId: "op-1", type: "order.line_added", code: "not_found", message: "Item no longer exists", at: "2026-11-13T09:15:00.000Z", source: "cloud" },
  { opId: "op-2", type: "bill.finalized", code: "orphan", message: "Bill H1-000123 has no sync record", at: "2026-11-13T09:20:00.000Z", source: "orphan" },
];

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SyncIssuesScreen (W3)", () => {
  it("lists rejections and orphans with type, code, message and time", async () => {
    stubFetch(() => json(200, { items: ITEMS }));
    render(<SyncIssuesScreen />);
    const row = await screen.findByTestId("pos-sync-issue-row-op-1");
    expect(row.textContent).toContain("Rejected by cloud");
    expect(row.textContent).toContain("order.line_added");
    expect(row.textContent).toContain("not_found");
    expect(row.textContent).toContain("Item no longer exists");
    expect(row.textContent).toContain("13 Nov 2026");
    expect(screen.getByTestId("pos-sync-issue-row-op-2").textContent).toContain("Never synced");
  });

  it("acknowledges an issue and removes it from the list", async () => {
    const fetchMock = stubFetch((url) => (url.endsWith("/acknowledge") ? json(204, null) : json(200, { items: ITEMS })));
    render(<SyncIssuesScreen />);
    await userEvent.click(await screen.findByTestId("pos-sync-issue-acknowledge-op-1"));
    await waitFor(() => expect(screen.queryByTestId("pos-sync-issue-row-op-1")).toBeNull());
    expect(screen.getByTestId("pos-sync-issue-row-op-2")).toBeTruthy();
    const ack = fetchMock.mock.calls.find(([url]) => url.endsWith("/acknowledge"));
    expect(ack?.[0]).toBe("/pos/api/hub/rejections/op-1/acknowledge");
    expect(ack?.[1]?.method).toBe("POST");
  });

  it("keeps the row and shows the hub's message when acknowledging fails", async () => {
    stubFetch((url) => (url.endsWith("/acknowledge") ? json(503, { error: { code: "offline", message: "The hub is offline; try again once it syncs." } }) : json(200, { items: ITEMS })));
    render(<SyncIssuesScreen />);
    await userEvent.click(await screen.findByTestId("pos-sync-issue-acknowledge-op-2"));
    expect((await screen.findByTestId("pos-sync-issues-action-error")).textContent).toBe("The hub is offline; try again once it syncs.");
    expect(screen.getByTestId("pos-sync-issue-row-op-2")).toBeTruthy();
  });

  it("shows an empty state when there is nothing to fix", async () => {
    stubFetch(() => json(200, { items: [] }));
    render(<SyncIssuesScreen />);
    expect(await screen.findByTestId("pos-sync-issues-empty")).toBeTruthy();
  });

  it("shows a retryable error when the list can't load", async () => {
    stubFetch(() => json(403, { error: { code: "forbidden", message: "Missing permission" } }));
    render(<SyncIssuesScreen />);
    expect(await screen.findByTestId("pos-sync-issues-load-error")).toBeTruthy();
    expect(screen.getByTestId("pos-sync-issues-load-error-retry")).toBeTruthy();
  });
});
