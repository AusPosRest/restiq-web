import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftScreen } from "./shift-screen";

const OUTLET_ID = "outlet-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let currentShift: unknown = null;

function stubFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/pos/api/shifts/current?outletId=") && method === "GET") {
      return Promise.resolve(currentShift ? jsonResponse(currentShift) : jsonResponse({ error: { code: "not_found" } }, 404));
    }
    if (url.endsWith("/pos/api/shifts") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { outletId: string; floatMinor: number };
      currentShift = {
        id: "shift-1",
        outletId: body.outletId,
        openedAt: "2026-08-25T09:00:00.000Z",
        floatMinor: body.floatMinor,
        cashMovements: [],
      };
      return Promise.resolve(jsonResponse(currentShift));
    }
    if (url.endsWith("/pos/api/shifts/shift-1/cash-movements") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { type: string; amountMinor: number; reason: string };
      const shift = currentShift as { cashMovements: unknown[] };
      shift.cashMovements = [
        ...shift.cashMovements,
        { id: "movement-1", type: body.type, amountMinor: body.amountMinor, reason: body.reason, createdAt: "2026-08-25T10:00:00.000Z" },
      ];
      return Promise.resolve(jsonResponse(currentShift));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  currentShift = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShiftScreen - open shift", () => {
  it("shows the open-shift form when there's no shift, with submit disabled until a float is entered", async () => {
    stubFetch();
    render(<ShiftScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("open-shift-form")).toBeTruthy();
    expect(screen.getByTestId("open-shift-submit")).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-5"));
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-0"));
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-0"));
    expect(screen.getByTestId("open-shift-keypad-display").textContent).toBe("₹5.00");
    expect(screen.getByTestId("open-shift-submit")).toHaveProperty("disabled", false);
  });

  it("opens a shift with the entered float and shows the dashboard", async () => {
    stubFetch();
    render(<ShiftScreen outletId={OUTLET_ID} />);

    await screen.findByTestId("open-shift-form");
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-2"));
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-0"));
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-0"));
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-0"));
    await userEvent.click(screen.getByTestId("open-shift-submit"));

    expect(await screen.findByTestId("shift-dashboard")).toBeTruthy();
    expect(screen.getByTestId("shift-opening-float").textContent).toBe("₹20.00");
    expect(screen.getByTestId("movement-log-empty")).toBeTruthy();
  });
});

describe("ShiftScreen - cash movements", () => {
  async function openAShift() {
    render(<ShiftScreen outletId={OUTLET_ID} />);
    await screen.findByTestId("open-shift-form");
    await userEvent.click(screen.getByTestId("open-shift-keypad-digit-1"));
    await userEvent.click(screen.getByTestId("open-shift-submit"));
    await screen.findByTestId("shift-dashboard");
  }

  it("requires a positive amount and a reason before the movement can be logged", async () => {
    stubFetch();
    await openAShift();

    await userEvent.click(screen.getByTestId("log-movement-open"));
    expect(screen.getByTestId("movement-submit")).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByTestId("movement-amount-keypad-digit-5"));
    expect(screen.getByTestId("movement-submit")).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByTestId("movement-reason"), "Change for the bank");
    expect(screen.getByTestId("movement-submit")).toHaveProperty("disabled", false);
  });

  it("logs a cash movement and appends it to the log with its reason", async () => {
    stubFetch();
    await openAShift();

    await userEvent.click(screen.getByTestId("log-movement-open"));
    await userEvent.click(screen.getByTestId("movement-amount-keypad-digit-5"));
    await userEvent.click(screen.getByTestId("movement-amount-keypad-digit-0"));
    await userEvent.click(screen.getByTestId("movement-amount-keypad-digit-0"));
    await userEvent.type(screen.getByTestId("movement-reason"), "Petty cash for supplies");
    await userEvent.click(screen.getByTestId("movement-submit"));

    expect(await screen.findByTestId("movement-row-movement-1")).toBeTruthy();
    expect(screen.getByTestId("movement-row-movement-1").textContent).toContain("Petty cash for supplies");
    expect(screen.getByTestId("movement-row-movement-1").textContent).toContain("₹5.00");
    expect(screen.queryByTestId("log-movement-dialog")).toBeNull();
  });
});
