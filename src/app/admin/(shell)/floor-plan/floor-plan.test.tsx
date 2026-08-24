import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { FloorPlan } from "./floor-plan";

const OUTLETS = [{ id: "outlet-1", name: "Indiranagar", address: "100 Ft Road", type: "dine_in", timezone: "Asia/Kolkata" }];

// Shape matches restiq-backend's actual GET .../floor-plan response
// (floor-plan.dtos.ts's FloorPlanView): floors carry their own tables
// nested; stations and printers are returned alongside, not separately.
function floorPlanResponse() {
  return {
    floors: [
      {
        id: "floor-1",
        outletId: "outlet-1",
        name: "Ground Floor",
        sortOrder: 0,
        tables: [{ id: "t1", floorId: "floor-1", label: "T1", x: 40, y: 40, width: 40, height: 40, shape: "square", seatCapacity: 4 }],
      },
    ],
    stations: [{ id: "station-1", outletId: "outlet-1", name: "Expo", ageingThresholdMinutes: 10, primaryPrinterId: null, fallbackPrinterId: null }],
    printers: [{ id: "printer-1", outletId: "outlet-1", name: "Printer 1", renderMode: "text" }],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch({ patchStatus = 200, patchBody }: { patchStatus?: number; patchBody?: unknown } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/tables/") && method === "PATCH") {
      if (patchStatus !== 200) {
        return Promise.resolve(jsonResponse({ error: { code: "table_overlap", message: "This table overlaps another table" } }, patchStatus));
      }
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({ ...floorPlanResponse().floors[0].tables[0], ...sent, ...(patchBody ?? {}) }));
    }
    if (url.includes("/floor-plan")) return Promise.resolve(jsonResponse(floorPlanResponse()));
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse(OUTLETS));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderFloorPlan() {
  return render(
    <ToastProvider>
      <OutletProvider>
        <FloorPlan />
      </OutletProvider>
    </ToastProvider>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FloorPlan", () => {
  it("loads the outlet's floor plan and renders the table on the canvas", async () => {
    stubFetch();
    renderFloorPlan();
    const shape = await screen.findByTestId("table-shape-t1");
    expect(shape.dataset.x).toBe("40");
    expect(shape.dataset.y).toBe("40");
  });

  it("switches to the list view and shows the same table data", async () => {
    stubFetch();
    renderFloorPlan();
    await screen.findByTestId("table-shape-t1");

    await userEvent.click(screen.getByTestId("floor-plan-view-list"));

    expect(await screen.findByTestId("floor-plan-list-row-t1")).toBeTruthy();
    expect(screen.getByTestId("floor-plan-list-x-t1")).toHaveProperty("value", "40");
  });

  it("moves a table with the keyboard and saves the new position", async () => {
    const fetchMock = stubFetch();
    renderFloorPlan();
    const shape = await screen.findByTestId("table-shape-t1");

    shape.focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(shape.dataset.x).toBe("48"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/outlets/outlet-1/tables/t1"),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ x: 48, y: 40 }) }),
    );
  });

  it("snaps a moved table back and toasts an error when the backend rejects it as an overlap", async () => {
    stubFetch({ patchStatus: 409 });
    renderFloorPlan();
    const shape = await screen.findByTestId("table-shape-t1");

    shape.focus();
    await userEvent.keyboard("{ArrowRight}");

    await screen.findByTestId("toast-error");
    expect(screen.getByTestId("toast-error").textContent).toContain("overlaps another table");
    await waitFor(() => expect(shape.dataset.x).toBe("40"));
  });
});
