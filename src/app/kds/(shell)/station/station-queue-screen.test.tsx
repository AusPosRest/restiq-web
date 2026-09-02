// Integration coverage for K1 (CAP-2, issue #66): oldest-left rendering,
// ADD-ON separation + void strikethrough from real response shapes, ageing
// color transitions computed client-side between polls, bump/recall/refire
// hitting the right endpoints, and stale-board-on-poll-failure.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KdsOutletProvider } from "../../kds-outlet-context";
import type { TicketView } from "../../api";
import { StationQueueScreen } from "./station-queue-screen";

// KdsHeader (rendered by StationQueueScreen) calls useRouter() for its
// sign-out button - mirrors sync-health-table.test.tsx's next/navigation mock.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const STATIONS = [{ id: "s1", name: "Tandoor", ageingThresholdMinutes: 10 }];

function ticket(overrides: Partial<TicketView>): TicketView {
  return {
    id: "t1",
    orderId: "order-1",
    stationId: "s1",
    stationName: "Tandoor",
    tableLabel: "T4",
    tokenNumber: 1035,
    status: "queued",
    firedAt: "2026-08-29T10:00:00.000Z",
    bumpedAt: null,
    recallCount: 0,
    recalled: false,
    lines: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Routes the mocked global fetch by URL suffix so each test only supplies what it cares about. `queueResponder` is called on every queue poll (a function, not a fixed value, so a test can vary it across polls). */
function mockFetch(queueResponder: () => TicketView[] | "fail") {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/stations")) return Promise.resolve(jsonResponse(STATIONS));
    if (url.includes("/queue")) {
      const result = queueResponder();
      if (result === "fail") return Promise.resolve(jsonResponse({ error: { code: "error", message: "boom" } }, 500));
      return Promise.resolve(jsonResponse(result));
    }
    if (url.includes("/bump") || url.includes("/recall") || url.includes("/refire")) {
      return Promise.resolve(jsonResponse(ticket({ status: "bumped" })));
    }
    throw new Error(`Unmocked fetch: ${init?.method ?? "GET"} ${url}`);
  });
}

function renderScreen() {
  return render(
    <KdsOutletProvider outlet={{ id: "o1", name: "Spice Route" }}>
      <StationQueueScreen stationId="s1" />
    </KdsOutletProvider>,
  );
}

describe("StationQueueScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-29T10:00:00.000Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders queued tickets oldest-left, in firedAt order", async () => {
    const tickets = [
      ticket({ id: "newest", firedAt: "2026-08-29T09:59:00.000Z" }),
      ticket({ id: "oldest", firedAt: "2026-08-29T09:50:00.000Z" }),
      ticket({ id: "middle", firedAt: "2026-08-29T09:55:00.000Z" }),
    ];
    vi.stubGlobal("fetch", mockFetch(() => tickets));
    renderScreen();

    const rail = await vi.waitFor(() => {
      const el = screen.getByTestId("kds-station-rail");
      expect(el.children.length).toBe(3);
      return el;
    });
    const ids = [...rail.children].map((child) => child.getAttribute("data-testid"));
    expect(ids).toEqual(["kds-ticket-oldest", "kds-ticket-middle", "kds-ticket-newest"]);
  });

  it("separates ADD-ON batches and strikes through voided lines, from a real-shaped response", async () => {
    const withAddOnAndVoid = ticket({
      lines: [
        { id: "l1", orderLineId: "ol1", itemId: "i1", itemName: "Tandoori Roti", variantName: null, quantity: 2, seatNumber: 1, modifiers: [], addOnBatch: 0, voided: false },
        { id: "l2", orderLineId: "ol2", itemId: "i2", itemName: "Paneer Tikka", variantName: null, quantity: 1, seatNumber: null, modifiers: [{ id: "m1", name: "Extra spicy" }], addOnBatch: 0, voided: true },
        { id: "l3", orderLineId: "ol3", itemId: "i3", itemName: "Garlic Naan", variantName: null, quantity: 1, seatNumber: null, modifiers: [], addOnBatch: 1, voided: false },
      ],
    });
    vi.stubGlobal("fetch", mockFetch(() => [withAddOnAndVoid]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1")).toBeTruthy());
    expect(screen.getByTestId("kds-ticket-t1-addon-1").textContent).toContain("ADD-ON");
    expect(screen.getByTestId("kds-line-l2-void").textContent).toContain("VOID");
    expect(screen.getByTestId("kds-line-l2").className).not.toContain("line-through");
    expect(screen.getByTestId("kds-line-l2").querySelector("div")?.className).toContain("line-through");
    expect(screen.getByTestId("kds-line-l1-seat").textContent).toContain("S1");
  });

  it("renders the RECALLED banner as real data from ticket.recalled, not local UI memory", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [ticket({ recalled: true, recallCount: 1 })]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1-recalled-banner").textContent).toContain("RECALLED"));
  });

  it(
    "crosses blue -> yellow -> red exactly at the station's ageing thresholds, without waiting for a poll",
    async () => {
      vi.stubGlobal("fetch", mockFetch(() => [ticket({})]));
      renderScreen();

      await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1").getAttribute("data-ageing")).toBe("new"));

      await vi.advanceTimersByTimeAsync(10 * 60_000);
      await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1").getAttribute("data-ageing")).toBe("ageing"));

      await vi.advanceTimersByTimeAsync(10 * 60_000);
      await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1").getAttribute("data-ageing")).toBe("urgent"));
    },
    // Two 10-minute fake-timer advances each drive a real vi.waitFor poll loop;
    // under full-suite parallel load (CPU contention across worker threads)
    // that easily exceeds vitest's 5s default. The assertions are unchanged -
    // this only gives the test enough wall-clock room to finish (issue #91).
    20_000,
  );

  it("bump/recall/refire call the ticket's real endpoints", async () => {
    const fetchMock = mockFetch(() => [ticket({})]);
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1-bump")).toBeTruthy());
    fireEvent.click(screen.getByTestId("kds-ticket-t1-bump"));
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/tickets/t1/bump"))).toBe(true));
    // Bump/refire share one per-ticket pending lock (single tap, no double
    // submission) - wait for it to clear before the next tap on this ticket.
    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1-refire").hasAttribute("disabled")).toBe(false));

    fireEvent.click(screen.getByTestId("kds-ticket-t1-refire"));
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/tickets/t1/refire"))).toBe(true));
  });

  it("keeps the stale board on screen and shows the reconnecting notice when a poll fails", async () => {
    let succeed = true;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => (succeed ? [ticket({})] : "fail")),
    );
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1")).toBeTruthy());

    succeed = false;
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => expect(screen.getByTestId("kds-reconnecting-notice")).toBeTruthy());
    // The board itself never blanks - the last-known ticket is still there.
    expect(screen.getByTestId("kds-ticket-t1")).toBeTruthy();
  });

  it("shows a calm empty state, loud that the display is alive, when the station has no queued tickets", async () => {
    vi.stubGlobal("fetch", mockFetch(() => []));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-station-empty").textContent).toContain("Tandoor"));
    expect(screen.getByText("No open tickets")).toBeTruthy();
  });
});
