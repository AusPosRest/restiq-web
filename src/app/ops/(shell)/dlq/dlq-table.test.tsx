// O9/O9a Dead-Letter Queue: five-state table, per-row and bulk-by-filter
// replay, and per-op result chips + a summary banner shown inline - never a
// silent toast, never a navigate-away (EXPERIENCE.md, CAP-7).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeadLetterListResult, DeadLetterView } from "../api";
import { ToastProvider } from "../toast";
import { DlqTable } from "./dlq-table";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/ops/dlq",
  useSearchParams: () => new URLSearchParams(search),
}));

function deadLetter(overrides: Partial<DeadLetterView>): DeadLetterView {
  return {
    id: "0193dddd-0000-7000-8000-000000000001",
    tenantId: "0193tttt-0000-7000-8000-000000000001",
    tenantName: "Spice Route Hospitality",
    deviceId: "0193vvvv-0000-7000-8000-000000000001",
    deviceLabel: "Terminal 1",
    opId: "0193oooo-0000-7000-8000-000000000001",
    reasonCode: "clock_skew",
    reasonText: "Clock skew exceeds 120s - device clock is 4m ahead",
    payloadMeta: { kind: "order.sync" },
    createdAt: "2026-08-24T08:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function listResponse(deadLetters: DeadLetterView[]): DeadLetterListResult {
  return { deadLetters, nextCursor: null, total: deadLetters.length };
}

function renderTable(deadLetters: DeadLetterView[], extraRoutes?: (url: string, init?: RequestInit) => Response | undefined) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const extra = extraRoutes?.(url, init);
    if (extra) return Promise.resolve(extra);
    if (url.includes("/ops/api/dead-letters?")) return Promise.resolve(jsonResponse(listResponse(deadLetters)));
    if (url.includes("/ops/api/tenants?")) return Promise.resolve(jsonResponse({ tenants: [], nextCursor: null, total: 0 }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <ToastProvider>
      <DlqTable />
    </ToastProvider>,
  );
  return fetchMock;
}

describe("DlqTable", () => {
  beforeEach(() => {
    replace.mockReset();
    search = "";
    vi.unstubAllGlobals();
  });
  afterEach(() => cleanup());

  it("shows skeleton rows while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(
      <ToastProvider>
        <DlqTable />
      </ToastProvider>,
    );
    expect(screen.getByTestId("dlq-loading")).toBeTruthy();
  });

  it("lists unresolved rows with tenant, device and reason", async () => {
    const row = deadLetter({});
    renderTable([row]);
    const table = await screen.findByTestId("dlq-table");
    expect(table.textContent).toContain("Spice Route Hospitality");
    expect(table.textContent).toContain("Terminal 1");
    expect(screen.getByTestId("dlq-count").textContent).toContain("1");
  });

  it("shows the true-empty state with no filters active", async () => {
    renderTable([]);
    expect(await screen.findByTestId("dlq-empty")).toBeTruthy();
  });

  it("shows the filtered-empty state distinctly when a filter yields nothing", async () => {
    search = "reasonCode=schema_skew";
    renderTable([]);
    expect(await screen.findByTestId("dlq-filtered-empty")).toBeTruthy();
  });

  it("filtering by reason updates the URL and refetches", async () => {
    renderTable([deadLetter({})]);
    await screen.findByTestId("dlq-table");
    await userEvent.selectOptions(screen.getByTestId("dlq-filter-reason"), "schema_skew");
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("reasonCode=schema_skew")));
  });

  it("replays a single op and shows the inline result - never a silent toast", async () => {
    const row = deadLetter({});
    const fetchMock = renderTable([row], (url, init) => {
      if (url.endsWith(`/ops/api/dead-letters/${row.id}/replay`) && init?.method === "POST") {
        return jsonResponse({ id: row.id, status: "applied" });
      }
      return undefined;
    });

    await userEvent.click(await screen.findByTestId(`dlq-replay-${row.id}`));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("Replay");
    await userEvent.type(screen.getByTestId("confirm-reason"), "Device clock corrected");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    const results = await screen.findByTestId("dlq-results");
    expect(results.textContent).toContain("Applied");
    expect(screen.getByTestId(`dlq-results-row-${row.id}-result`).textContent).toBe("Applied");
    expect(screen.getByTestId("dlq-results-summary").textContent).toContain("1");
    // Never a silent success toast for this action.
    expect(screen.queryByTestId("toast-success")).toBeNull();

    const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/dead-letters/${row.id}/replay`))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ reason: "Device clock corrected" });
  });

  it("returning to the queue from the results view refreshes the list", async () => {
    const row = deadLetter({});
    renderTable([row], (url, init) => {
      if (url.endsWith(`/ops/api/dead-letters/${row.id}/replay`) && init?.method === "POST") {
        return jsonResponse({ id: row.id, status: "applied" });
      }
      return undefined;
    });

    await userEvent.click(await screen.findByTestId(`dlq-replay-${row.id}`));
    await userEvent.type(screen.getByTestId("confirm-reason"), "fixed");
    await userEvent.click(screen.getByTestId("confirm-submit"));
    await screen.findByTestId("dlq-results");

    await userEvent.click(screen.getByTestId("dlq-results-back"));
    await screen.findByTestId("dlq-table");
    expect(screen.queryByTestId("dlq-results")).toBeNull();
  });

  it("bulk-replays everything matching the current filter and shows a per-op summary banner", async () => {
    search = "reasonCode=clock_skew";
    const a = deadLetter({ id: "op-a", reasonCode: "clock_skew" });
    const b = deadLetter({ id: "op-b", reasonCode: "clock_skew", deviceLabel: "Terminal 2" });
    renderTable([a, b], (url, init) => {
      if (url.endsWith("/ops/api/dead-letters/replay-bulk") && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { reason: string; reasonCode?: string };
        expect(body.reasonCode).toBe("clock_skew");
        return jsonResponse({
          results: [
            { id: "op-a", status: "applied" },
            { id: "op-b", status: "duplicate" },
          ],
        });
      }
      return undefined;
    });

    await userEvent.click(await screen.findByTestId("dlq-replay-all"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Bulk remediation after outbox fix");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    const banner = await screen.findByTestId("dlq-results-summary");
    expect(banner.textContent).toContain("2");
    expect(screen.getByTestId("dlq-results-row-op-a-result").textContent).toBe("Applied");
    expect(screen.getByTestId("dlq-results-row-op-b-result").textContent).toBe("Duplicate");
  });

  it("honors ?tenantId and ?deviceId pre-filter params for direct navigation", async () => {
    search = "tenantId=t1&deviceId=d1";
    const fetchMock = renderTable([]);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => (url as string).includes("tenantId=t1") && (url as string).includes("deviceId=d1"))).toBe(
        true,
      ),
    );
  });
});
