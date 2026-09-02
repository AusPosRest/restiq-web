// Integration coverage for K2 (CAP-3, issue #70): per-order consolidation
// and the Waiting-On panel rendering from the real ExpoOrderView shape,
// readiness chips flipping with bump state, and stale-board-on-poll-failure
// (same convention as station-queue-screen.test.tsx).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KdsOutletProvider } from "../../kds-outlet-context";
import type { ExpoOrderView, TicketLineView, TicketView } from "../../api";
import { ExpoScreen } from "./expo-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const STATIONS = [
  { id: "tandoor", name: "Tandoor", ageingThresholdMinutes: 10 },
  { id: "curry", name: "Curry", ageingThresholdMinutes: 10 },
];

function line(overrides: Partial<TicketLineView>): TicketLineView {
  return {
    id: "l1",
    orderLineId: "ol1",
    itemId: "naan",
    itemName: "Garlic Naan",
    variantName: null,
    quantity: 2,
    seatNumber: null,
    modifiers: [],
    addOnBatch: 0,
    voided: false,
    ...overrides,
  };
}

function ticket(overrides: Partial<TicketView>): TicketView {
  return {
    id: "t1",
    orderId: "order-1",
    stationId: "tandoor",
    stationName: "Tandoor",
    tableLabel: "T4",
    tokenNumber: 1035,
    status: "queued",
    firedAt: "2026-08-29T10:00:00.000Z",
    bumpedAt: null,
    recallCount: 0,
    recalled: false,
    lines: [line({})],
    ...overrides,
  };
}

function twoStationOrder(): ExpoOrderView {
  const tandoorTicket = ticket({ id: "t-tandoor", stationId: "tandoor", stationName: "Tandoor", lines: [line({ id: "l-naan", itemName: "Garlic Naan" })] });
  const curryTicket = ticket({
    id: "t-curry",
    stationId: "curry",
    stationName: "Curry",
    status: "bumped",
    bumpedAt: "2026-08-29T10:01:00.000Z",
    lines: [line({ id: "l-butter-chicken", itemName: "Butter Chicken", itemId: "butter-chicken" })],
  });
  return {
    orderId: "order-1",
    tableLabel: "T4",
    tokenNumber: 1035,
    stations: [
      { stationId: "tandoor", stationName: "Tandoor", ready: false, tickets: [tandoorTicket] },
      { stationId: "curry", stationName: "Curry", ready: true, tickets: [curryTicket] },
    ],
    waitingOn: tandoorTicket.lines,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mockFetch(expoResponder: () => ExpoOrderView[] | "fail") {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/stations")) return Promise.resolve(jsonResponse(STATIONS));
    if (url.includes("/expo")) {
      const result = expoResponder();
      if (result === "fail") return Promise.resolve(jsonResponse({ error: { code: "error", message: "boom" } }, 500));
      return Promise.resolve(jsonResponse(result));
    }
    throw new Error(`Unmocked fetch: ${url}`);
  });
}

function renderScreen() {
  return render(
    <KdsOutletProvider outlet={{ id: "o1", name: "Spice Route" }}>
      <ExpoScreen />
    </KdsOutletProvider>,
  );
}

describe("ExpoScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-29T10:05:00.000Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("consolidates an order's two stations into one row with an item roll-up per station", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [twoStationOrder()]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-order-order-1")).toBeTruthy());
    expect(screen.getByTestId("kds-expo-order-order-1-station-tandoor")).toBeTruthy();
    expect(screen.getByTestId("kds-expo-order-order-1-station-curry")).toBeTruthy();
    expect(screen.getByTestId("kds-expo-order-order-1-item-naan:").textContent).toContain("Garlic Naan");
    expect(screen.getByTestId("kds-expo-order-order-1-progress").textContent).toBe("1 of 2 ready");
  });

  it("renders the Waiting-On panel with exactly the not-yet-bumped items", async () => {
    vi.stubGlobal("fetch", mockFetch(() => [twoStationOrder()]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-waiting-on-list")).toBeTruthy());
    expect(screen.getByTestId("kds-waiting-on-l-naan")).toBeTruthy();
    expect(screen.queryByTestId("kds-waiting-on-l-butter-chicken")).toBeNull();
  });

  it("flips a station's readiness chip from Cooking to Ready once every ticket at that station is bumped", async () => {
    let curryBumped = false;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => {
        const o = twoStationOrder();
        if (curryBumped) return [o];
        // Before curryBumped: both stations still cooking.
        o.stations[1] = { ...o.stations[1], ready: false, tickets: [{ ...o.stations[1].tickets[0], status: "queued" }] };
        return [o];
      }),
    );
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-order-order-1-station-curry-chip").textContent).toContain("Cooking"));

    curryBumped = true;
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-order-order-1-station-curry-chip").textContent).toContain("Ready"));
  });

  it("shows the order as fully Ready once every station is bumped", async () => {
    const o = twoStationOrder();
    o.stations[0] = { ...o.stations[0], ready: true, tickets: [{ ...o.stations[0].tickets[0], status: "bumped" }] };
    o.waitingOn = [];
    vi.stubGlobal("fetch", mockFetch(() => [o]));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-order-order-1").getAttribute("data-ready")).toBe("true"));
    expect(screen.getByTestId("kds-expo-order-order-1-elapsed").textContent).toContain("Ready");
  });

  it("keeps the stale board on screen and shows the reconnecting notice when a poll fails", async () => {
    let succeed = true;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => (succeed ? [twoStationOrder()] : "fail")),
    );
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-order-order-1")).toBeTruthy());

    succeed = false;
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => expect(screen.getByTestId("kds-reconnecting-notice")).toBeTruthy());
    expect(screen.getByTestId("kds-expo-order-order-1")).toBeTruthy();
  });

  it("shows a calm empty state when there are no open orders", async () => {
    vi.stubGlobal("fetch", mockFetch(() => []));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-empty")).toBeTruthy());
    expect(screen.getByText("No open orders")).toBeTruthy();
  });

  it("shows the Expo-tab explainer", async () => {
    vi.stubGlobal("fetch", mockFetch(() => []));
    renderScreen();

    await vi.waitFor(() => expect(screen.getByTestId("kds-expo-empty")).toBeTruthy());
    expect(screen.getByTestId("kds-tab-subtitle").textContent).toBe("Everything across stations that's ready to go out");
  });
});
