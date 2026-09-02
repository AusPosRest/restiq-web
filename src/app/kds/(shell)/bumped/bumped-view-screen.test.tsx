// Integration coverage for K3 (CAP-4, issue #71): bumped tickets render
// newest-first via the reused TicketCard, recall history is visible, a
// single tap recalls a ticket (its endpoint hit, then removed from the list
// on the next poll once it's back to "queued"), and a failed poll keeps the
// stale board on screen. Mirrors station-queue-screen.test.tsx's shape.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KdsOutletProvider } from "../../kds-outlet-context";
import type { BumpedTicketView } from "../../api";
import { BumpedViewScreen } from "./bumped-view-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function ticket(overrides: Partial<BumpedTicketView>): BumpedTicketView {
  return {
    id: "t1",
    orderId: "order-1",
    stationId: "s1",
    stationName: "Tandoor",
    tableLabel: "T4",
    tokenNumber: 1035,
    status: "bumped",
    firedAt: "2026-08-29T09:50:00.000Z",
    bumpedAt: "2026-08-29T10:00:00.000Z",
    recallCount: 0,
    recalled: false,
    lines: [],
    recallHistory: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Routes the mocked global fetch by URL suffix - `bumpedResponder` is called on every /bumped poll so a test can vary the result across polls (e.g. simulate a recalled ticket dropping out). */
function mockFetch(bumpedResponder: () => BumpedTicketView[] | "fail") {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/bumped")) {
      const result = bumpedResponder();
      if (result === "fail") return Promise.resolve(jsonResponse({ error: { code: "error", message: "boom" } }, 500));
      return Promise.resolve(jsonResponse(result));
    }
    if (url.includes("/recall")) {
      return Promise.resolve(jsonResponse(ticket({ status: "queued", recalled: true, recallCount: 1 })));
    }
    throw new Error(`Unmocked fetch: ${init?.method ?? "GET"} ${url}`);
  });
}

function renderScreen() {
  return render(
    <KdsOutletProvider outlet={{ id: "o1", name: "Spice Route" }}>
      <BumpedViewScreen />
    </KdsOutletProvider>,
  );
}

describe("BumpedViewScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-29T10:10:00.000Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders bumped tickets newest-bumped-first", async () => {
    const tickets = [
      ticket({ id: "oldest", bumpedAt: "2026-08-29T09:50:00.000Z" }),
      ticket({ id: "newest", bumpedAt: "2026-08-29T10:05:00.000Z" }),
      ticket({ id: "middle", bumpedAt: "2026-08-29T09:58:00.000Z" }),
    ];
    vi.stubGlobal("fetch", mockFetch(() => tickets));
    renderScreen();

    const rail = await vi.waitFor(() => {
      const el = screen.getByTestId("kds-bumped-rail");
      expect(el.children.length).toBe(3);
      return el;
    });
    const ids = [...rail.children].map((child) => child.getAttribute("data-testid"));
    expect(ids).toEqual(["kds-ticket-newest", "kds-ticket-middle", "kds-ticket-oldest"]);
  });

  it("shows recall history as one quiet line, not a red banner", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [ticket({ recallCount: 2, recalled: true, recallHistory: ["2026-08-29T09:00:00.000Z", "2026-08-29T09:30:00.000Z"] })]));
    renderScreen();

    const history = await vi.waitFor(() => screen.getByTestId("kds-ticket-t1-recall-history"));
    expect(history.textContent).toContain("Recalled 2×");
    expect(history.textContent).toContain("last");
    expect(history.className).not.toContain("ticket-recalled");
    // A bumped ticket is done - the loud RECALLED banner is for an active,
    // just-recalled ticket back in a queue, not a finished one.
    expect(screen.queryByTestId("kds-ticket-t1-recalled-banner")).toBeNull();
  });

  it("renders no history strip for a ticket that was never recalled", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [ticket({})]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1")).toBeTruthy());
    expect(screen.queryByTestId("kds-ticket-t1-recall-history")).toBeNull();
  });

  it("shows a static 'Bumped ... took ...' line instead of a live ageing clock", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [ticket({ firedAt: "2026-08-29T09:50:00.000Z", bumpedAt: "2026-08-29T10:00:00.000Z" })]));
    renderScreen();

    const summary = await vi.waitFor(() => screen.getByTestId("kds-ticket-t1-bumped-summary"));
    expect(summary.textContent).toContain("Bumped");
    expect(summary.textContent).toContain("took");
    expect(screen.queryByTestId("kds-ticket-t1-elapsed")).toBeNull();

    const before = summary.textContent;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(summary.textContent).toBe(before);
  });

  it("gives a bumped card a neutral border, not the ageing color scale", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [ticket({})]));
    renderScreen();

    const card = await vi.waitFor(() => screen.getByTestId("kds-ticket-t1"));
    expect(card.hasAttribute("data-ageing")).toBe(false);
    expect(card.className).not.toContain("ticket-bumped");
    expect(card.className).not.toContain("ticket-new");
    expect(card.className).not.toContain("ticket-ageing");
    expect(card.className).not.toContain("ticket-urgent");
  });

  it("shows the Bumped-tab explainer", async () => {
    vi.stubGlobal("fetch", mockFetch(() => []));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-bumped-empty")).toBeTruthy());
    expect(screen.getByTestId("kds-tab-subtitle").textContent).toBe("Done tickets — recall one if a plate comes back");
  });

  it("recalls a bumped ticket with a single tap, no confirmation, and it drops off the list on the next poll", async () => {
    let recalled = false;
    const fetchMock = mockFetch(() => (recalled ? [] : [ticket({})]));
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-ticket-t1-recall")).toBeTruthy());
    fireEvent.click(screen.getByTestId("kds-ticket-t1-recall"));

    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/tickets/t1/recall"))).toBe(true));
    recalled = true;

    await vi.waitFor(() => expect(screen.queryByTestId("kds-ticket-t1")).toBeNull());
    expect(screen.getByTestId("kds-bumped-empty")).toBeTruthy();
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

    await vi.waitFor(() => expect(screen.getByTestId("kds-bumped-reconnecting-notice")).toBeTruthy());
    expect(screen.getByTestId("kds-ticket-t1")).toBeTruthy();
  });

  it("shows a calm empty state when there are no bumped tickets", async () => {
    vi.stubGlobal("fetch", mockFetch(() => []));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-bumped-empty")).toBeTruthy());
    expect(screen.getByText("No bumped tickets")).toBeTruthy();
  });
});
