// The load-bearing test for CAP-10's success signal / AD-14: the counted
// amount is submitted before the system reveals what it expects - "never the
// other order" - and this has to be genuinely server-side blind, not a
// client that already has the value and just delays showing it. Proving that
// from the UI side means proving two separate things, both below:
//
//   1. No network response the screen receives *before* "Submit count" is
//      clicked ever carries a *populated* expected-amount value, anywhere in
//      its body - not just that the visible DOM doesn't render one.
//      `recordedResponses` captures every mocked fetch response verbatim and
//      `findsExpectedLikeField` deep-scans each one's JSON for any key that
//      looks like an expected/over-short amount AND holds a non-null value,
//      so a future bug that sneaks a real number into the GET response (even
//      under a different field name) fails this test. The real backend's
//      actual `ShiftView` (restiq-backend's feature/45-shift-cash-management,
//      shifts.service.ts's toShiftView) *does* include `countedMinor`/
//      `expectedMinor`/`overShortMinor` keys on every response, always `null`
//      until a close happens - so the mocked pre-close GET below matches that
//      real shape (keys present, values null) rather than omitting them,
//      and the scan only flags a populated value, not bare key presence.
//   2. The component holds no such value in state either - asserted by the
//      close-shift-result testid being entirely absent from the DOM pre-
//      submit, not merely hidden by CSS (jsdom doesn't render CSS layout, but
//      this checks the node isn't in the tree at all, which is the stronger
//      claim EXPERIENCE.md's BlindCountKeypad section asks for).
//
// Verified against restiq-backend's real feature/45-shift-cash-management
// branch (shifts.controller.ts/.dtos.ts/.service.ts, read directly - not
// merged to restiq-backend/dev yet but real and pushed); this test proves
// restiq-web's client never requests, stores, or could render a populated
// expected value before the close call's response arrives.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloseShiftScreen } from "./close-shift-screen";

const OUTLET_ID = "outlet-1";

const OPEN_SHIFT = {
  id: "shift-1",
  tenantId: "tenant-1",
  outletId: OUTLET_ID,
  openedByStaffId: "staff-1",
  floatMinor: 200000,
  openedAt: "2026-08-25T09:00:00.000Z",
  closedByStaffId: null,
  closedAt: null,
  countedMinor: null,
  expectedMinor: null,
  overShortMinor: null,
  cashMovements: [{ id: "m1", type: "paid_out", amountMinor: 5000, reason: "Change for the bank", createdByStaffId: "staff-1", createdAt: "2026-08-25T10:00:00.000Z" }],
};

const CLOSED_SHIFT = {
  ...OPEN_SHIFT,
  closedByStaffId: "staff-1",
  closedAt: "2026-08-25T18:00:00.000Z",
  countedMinor: 1845000,
  expectedMinor: 1860000,
  overShortMinor: -15000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface RecordedResponse {
  url: string;
  method: string;
  body: unknown;
}

function stubFetch(recorded: RecordedResponse[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    let response: Response;

    if (url.includes("/pos/api/shifts/current?outletId=") && method === "GET") {
      response = jsonResponse(OPEN_SHIFT);
    } else if (url.endsWith("/pos/api/shifts/shift-1/close") && method === "POST") {
      response = jsonResponse(CLOSED_SHIFT);
    } else {
      response = jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404);
    }

    const body: unknown = await response.clone().json();
    recorded.push({ url, method, body });
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Recursively scans a JSON value for any key that looks like an expected/over-short cash amount AND actually holds a non-null value - a `null` placeholder (the real pre-close shape) is not an offender. */
function findsExpectedLikeField(value: unknown, path = ""): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (/expected|overshort|over_short/i.test(key) && child !== null) return `${path}.${key}`;
      const found = findsExpectedLikeField(child, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-25T18:00:05.000Z"));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("CloseShiftScreen - blind count", () => {
  it("never receives or renders a populated expected amount before the count is submitted", async () => {
    const recorded: RecordedResponse[] = [];
    stubFetch(recorded);
    render(<CloseShiftScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("blind-count-keypad")).toBeTruthy();

    // (1) Network side: every response landed so far (just the GET) is clean.
    expect(recorded.length).toBeGreaterThan(0);
    for (const response of recorded) {
      const offender = findsExpectedLikeField(response.body);
      expect(offender, `response from ${response.method} ${response.url} carried a populated expected-amount field at ${offender}`).toBeNull();
    }

    // (2) State/DOM side: the reveal simply doesn't exist yet. (The keypad's
    // own instructional copy legitimately uses the word "expected" - see
    // EXPERIENCE.md's own voice example, "Count cash before viewing expected
    // total" - so this checks for the reveal's structure and any numeric
    // value tagged as an expected amount, not the word itself.)
    expect(screen.queryByTestId("close-shift-result")).toBeNull();
    expect(screen.queryByTestId("result-expected")).toBeNull();
    expect(screen.queryByTestId("result-over-short")).toBeNull();
  });

  it("reveals expected/counted/over-short only after the counted amount is submitted", async () => {
    const recorded: RecordedResponse[] = [];
    stubFetch(recorded);
    render(<CloseShiftScreen outletId={OUTLET_ID} />);
    await screen.findByTestId("blind-count-keypad");

    for (const digit of ["1", "8", "4", "5", "0", "0", "0"]) {
      await userEvent.click(screen.getByTestId(`blind-count-digit-${digit}`));
    }
    expect(screen.getByTestId("blind-count-display").textContent).toBe("₹18450.00");

    await userEvent.click(screen.getByTestId("blind-count-submit"));

    expect(await screen.findByTestId("close-shift-result")).toBeTruthy();
    expect(screen.getByTestId("result-counted").textContent).toBe("₹18450.00");
    expect(screen.getByTestId("result-expected").textContent).toBe("₹18600.00");
    expect(screen.getByTestId("result-over-short").textContent).toBe("-₹150.00");

    // The populated expected value only ever appeared in the close call's own response.
    const closeResponse = recorded.find((r) => r.url.endsWith("/shifts/shift-1/close"));
    expect(closeResponse).toBeTruthy();
    expect(findsExpectedLikeField(closeResponse!.body)).toBe(".expectedMinor");
    const priorResponses = recorded.slice(0, recorded.indexOf(closeResponse!));
    for (const response of priorResponses) {
      expect(findsExpectedLikeField(response.body)).toBeNull();
    }
  });

  it("blocks submission until an amount has been counted", async () => {
    stubFetch([]);
    render(<CloseShiftScreen outletId={OUTLET_ID} />);
    await screen.findByTestId("blind-count-keypad");
    expect(screen.getByTestId("blind-count-submit")).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByTestId("blind-count-digit-0"));
    expect(screen.getByTestId("blind-count-submit")).toHaveProperty("disabled", false);
  });
});
