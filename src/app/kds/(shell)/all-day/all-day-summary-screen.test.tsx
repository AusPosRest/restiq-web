// Integration coverage for K4 (CAP-5, issue #72): grid renders from the
// real, merged all-day-summary shape, sorted highest-count-first; counts
// update between polls; calm empty state; stale-board-on-poll-failure with
// the reconnecting notice.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KdsOutletProvider } from "../../kds-outlet-context";
import type { AllDaySummaryEntryView } from "../../api";
import { AllDaySummaryScreen } from "./all-day-summary-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Routes the mocked global fetch by URL suffix. `summaryResponder` is called on every all-day-summary poll (a function, not a fixed value, so a test can vary counts across polls). */
function mockFetch(summaryResponder: () => AllDaySummaryEntryView[] | "fail") {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/all-day-summary")) {
      const result = summaryResponder();
      if (result === "fail") return Promise.resolve(jsonResponse({ error: { code: "error", message: "boom" } }, 500));
      return Promise.resolve(jsonResponse(result));
    }
    throw new Error(`Unmocked fetch: ${url}`);
  });
}

function renderScreen() {
  return render(
    <KdsOutletProvider outlet={{ id: "o1", name: "Spice Route" }}>
      <AllDaySummaryScreen />
    </KdsOutletProvider>,
  );
}

describe("AllDaySummaryScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-29T10:00:00.000Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the grid from a real-shaped response, highest count first", async () => {
    const entries: AllDaySummaryEntryView[] = [
      { itemId: "i1", itemName: "Garlic Naan", quantity: 4 },
      { itemId: "i2", itemName: "Tandoori Roti", quantity: 12 },
      { itemId: "i3", itemName: "Paneer Tikka", quantity: 7 },
    ];
    vi.stubGlobal("fetch", mockFetch(() => entries));
    renderScreen();

    const grid = await vi.waitFor(() => {
      const el = screen.getByTestId("kds-all-day-grid");
      expect(el.children.length).toBe(3);
      return el;
    });
    const ids = [...grid.children].map((child) => child.getAttribute("data-testid"));
    expect(ids).toEqual(["kds-all-day-tile-i2", "kds-all-day-tile-i3", "kds-all-day-tile-i1"]);
    expect(screen.getByTestId("kds-all-day-tile-i2-count").textContent).toBe("12");
    expect(screen.getByTestId("kds-all-day-tile-i2-name").textContent).toBe("Tandoori Roti");
  });

  it("updates counts between polls without a remount", async () => {
    let quantity = 3;
    vi.stubGlobal("fetch", mockFetch(() => [{ itemId: "i1", itemName: "Tandoori Roti", quantity }]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-all-day-tile-i1-count").textContent).toBe("3"));

    quantity = 1;
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => expect(screen.getByTestId("kds-all-day-tile-i1-count").textContent).toBe("1"));
  });

  it("shows a calm empty state when there are no open tickets", async () => {
    vi.stubGlobal("fetch", mockFetch(() => []));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-all-day-empty")).toBeTruthy());
    expect(screen.getByText("No open tickets")).toBeTruthy();
  });

  it("keeps the stale grid on screen and shows the reconnecting notice when a poll fails", async () => {
    let succeed = true;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => (succeed ? [{ itemId: "i1", itemName: "Tandoori Roti", quantity: 5 }] : "fail")),
    );
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-all-day-tile-i1")).toBeTruthy());

    succeed = false;
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => expect(screen.getByTestId("kds-reconnecting-notice")).toBeTruthy());
    // The grid itself never blanks - the last-known counts are still there.
    expect(screen.getByTestId("kds-all-day-tile-i1-count").textContent).toBe("5");
  });

  it("shows the load-failed notice when the very first poll fails", async () => {
    vi.stubGlobal("fetch", mockFetch(() => "fail"));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-load-failed-notice")).toBeTruthy());
  });
});
