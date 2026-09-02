import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { FloorPlan } from "./floor-plan";

const OUTLETS = [{ id: "outlet-1", name: "Indiranagar", address: "100 Ft Road", type: "dine_in", timezone: "Asia/Kolkata" }];

const DEFAULT_FLOORS = [
  {
    id: "floor-1",
    outletId: "outlet-1",
    name: "Ground Floor",
    sortOrder: 0,
    tables: [{ id: "t1", floorId: "floor-1", label: "T1", x: 40, y: 40, width: 40, height: 40, shape: "square", seatCapacity: 4 }],
  },
];

// Shape matches restiq-backend's actual GET .../floor-plan response
// (floor-plan.dtos.ts's FloorPlanView): floors carry their own tables
// nested; stations and printers are returned alongside, not separately.
function floorPlanResponse(floors = DEFAULT_FLOORS) {
  return {
    floors,
    stations: [{ id: "station-1", outletId: "outlet-1", name: "Expo", ageingThresholdMinutes: 10, primaryPrinterId: null, fallbackPrinterId: null }],
    printers: [{ id: "printer-1", outletId: "outlet-1", name: "Printer 1", renderMode: "text" }],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch({
  patchStatus = 200,
  patchBody,
  floors,
  createFloorStatus = 201,
  createFloorBody,
  createTableStatus = 201,
  createTableBody,
  patchFloorStatus = 200,
  deleteFloorStatus = 204,
  deleteTableStatus = 204,
}: {
  patchStatus?: number;
  patchBody?: unknown;
  floors?: typeof DEFAULT_FLOORS;
  createFloorStatus?: number;
  createFloorBody?: unknown;
  createTableStatus?: number;
  createTableBody?: unknown;
  patchFloorStatus?: number;
  deleteFloorStatus?: number;
  deleteTableStatus?: number;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/floor-plan/floors/") && method === "PATCH") {
      if (patchFloorStatus !== 200) {
        return Promise.resolve(jsonResponse({ error: { code: "bad_request", message: "Invalid floor" } }, patchFloorStatus));
      }
      const floorId = url.split("/floors/")[1];
      const existing = (floors ?? DEFAULT_FLOORS).find((f) => f.id === floorId);
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({ id: floorId, outletId: "outlet-1", sortOrder: existing?.sortOrder ?? 0, name: existing?.name ?? "", ...sent }));
    }

    if (url.includes("/floor-plan/floors/") && method === "DELETE") {
      if (deleteFloorStatus !== 204) {
        return Promise.resolve(jsonResponse({ error: { code: "floor_has_tables", message: "This floor still has tables" } }, deleteFloorStatus));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (url.includes("/tables/") && method === "DELETE") {
      if (deleteTableStatus !== 204) {
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Table not found" } }, deleteTableStatus));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (url.includes("/tables/") && method === "PATCH") {
      if (patchStatus !== 200) {
        return Promise.resolve(jsonResponse({ error: { code: "table_overlap", message: "This table overlaps another table" } }, patchStatus));
      }
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({ ...floorPlanResponse().floors[0].tables[0], ...sent, ...(patchBody ?? {}) }));
    }

    if (url.includes("/floor-plan/floors") && method === "POST") {
      if (createFloorStatus !== 201) {
        return Promise.resolve(jsonResponse({ error: { code: "bad_request", message: "Invalid floor" } }, createFloorStatus));
      }
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({ id: "floor-2", outletId: "outlet-1", sortOrder: 1, ...sent, ...(createFloorBody ?? {}) }, 201));
    }

    if (url.includes("/floor-plan/tables") && method === "POST") {
      if (createTableStatus !== 201) {
        return Promise.resolve(jsonResponse({ error: { code: "table_overlap", message: "This table overlaps another table" } }, createTableStatus));
      }
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(jsonResponse({ id: "t2", ...sent, ...(createTableBody ?? {}) }, 201));
    }

    if (url.includes("/floor-plan")) return Promise.resolve(jsonResponse(floorPlanResponse(floors)));
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
      expect.stringContaining("/outlets/outlet-1/floor-plan/tables/t1"),
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

  describe("zero floors", () => {
    it("shows the empty state instead of a bare canvas/list, and lets the owner add the first floor from it", async () => {
      const fetchMock = stubFetch({ floors: [] });
      renderFloorPlan();

      expect(await screen.findByTestId("floor-plan-no-floors")).toBeTruthy();
      expect(screen.queryByTestId("floor-plan-view-toggle")).toBeNull();
      expect(screen.queryByTestId("floor-plan-toolbar")).toBeNull();

      await userEvent.click(screen.getByTestId("floor-plan-add-first-floor"));
      await userEvent.type(screen.getByTestId("floor-plan-add-floor-name"), "Ground Floor");
      await userEvent.click(screen.getByTestId("floor-plan-add-floor-submit"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/floors"),
          expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Ground Floor" }) }),
        ),
      );
      expect(await screen.findByTestId("floor-plan-view-toggle")).toBeTruthy();
      expect(screen.queryByTestId("floor-plan-no-floors")).toBeNull();
    });
  });

  describe("Add floor", () => {
    it("adds a floor from the toolbar and selects it", async () => {
      const fetchMock = stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");

      await userEvent.click(screen.getByTestId("floor-plan-add-floor-button"));
      await userEvent.type(screen.getByTestId("floor-plan-add-floor-name"), "First Floor");
      await userEvent.click(screen.getByTestId("floor-plan-add-floor-submit"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/floors"),
          expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "First Floor" }) }),
        ),
      );
      expect((await screen.findByTestId("floor-tab-floor-2")).getAttribute("aria-selected")).toBe("true");
      expect(screen.getByTestId("floor-tab-floor-1").getAttribute("aria-selected")).toBe("false");
    });

    it("toasts and keeps the form open with the entered name when the create request fails", async () => {
      stubFetch({ createFloorStatus: 500 });
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");

      await userEvent.click(screen.getByTestId("floor-plan-add-floor-button"));
      await userEvent.type(screen.getByTestId("floor-plan-add-floor-name"), "First Floor");
      await userEvent.click(screen.getByTestId("floor-plan-add-floor-submit"));

      await screen.findByTestId("toast-error");
      expect(screen.getByTestId("floor-plan-add-floor-name")).toHaveProperty("value", "First Floor");
    });
  });

  describe("Add table", () => {
    it("adds a table to the selected floor with a computed, non-overlapping default position", async () => {
      const fetchMock = stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");

      await userEvent.click(screen.getByTestId("floor-plan-add-table-button"));
      await userEvent.type(screen.getByTestId("floor-plan-add-table-label"), "T2");
      await userEvent.click(screen.getByTestId("floor-plan-add-table-submit"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/tables"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ floorId: "floor-1", label: "T2", x: 0, y: 0, width: 40, height: 40, shape: "square", seatCapacity: 4 }),
          }),
        ),
      );
      expect(await screen.findByTestId("table-shape-t2")).toBeTruthy();
      expect(screen.queryByTestId("floor-plan-add-table-form")).toBeNull();
    });

    it("rolls back the optimistic add and toasts the overlap copy when the backend rejects it with 409", async () => {
      stubFetch({ createTableStatus: 409 });
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");

      await userEvent.click(screen.getByTestId("floor-plan-add-table-button"));
      await userEvent.type(screen.getByTestId("floor-plan-add-table-label"), "T2");
      await userEvent.click(screen.getByTestId("floor-plan-add-table-submit"));

      await screen.findByTestId("toast-error");
      expect(screen.getByTestId("toast-error").textContent).toContain("This spot overlaps another table there. Adjust the position and try again.");
      expect(screen.queryByTestId("table-shape-t2")).toBeNull();
      // form stays open, pre-filled with what was entered
      expect(screen.getByTestId("floor-plan-add-table-label")).toHaveProperty("value", "T2");
    });

    it("appears in the list view without switching to canvas when a table is added while list view is active", async () => {
      stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");
      await userEvent.click(screen.getByTestId("floor-plan-view-list"));
      await screen.findByTestId("floor-plan-list-row-t1");

      await userEvent.click(screen.getByTestId("floor-plan-add-table-button"));
      await userEvent.type(screen.getByTestId("floor-plan-add-table-label"), "T2");
      await userEvent.click(screen.getByTestId("floor-plan-add-table-submit"));

      expect(await screen.findByTestId("floor-plan-list-row-t2")).toBeTruthy();
      expect(screen.queryByTestId("table-shape-t2")).toBeNull();
    });
  });

  describe("Rename floor", () => {
    it("renames the selected floor and shows the new name on its tab", async () => {
      const fetchMock = stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");

      await userEvent.click(screen.getByTestId("floor-plan-rename-floor-button"));
      const nameField = screen.getByTestId("floor-plan-rename-floor-name");
      await userEvent.clear(nameField);
      await userEvent.type(nameField, "First Floor");
      await userEvent.click(screen.getByTestId("floor-plan-rename-floor-submit"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/floors/floor-1"),
          expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "First Floor" }) }),
        ),
      );
      expect((await screen.findByTestId("floor-tab-floor-1")).textContent).toBe("First Floor");
      expect(screen.queryByTestId("floor-plan-rename-floor-form")).toBeNull();
    });
  });

  describe("Delete floor", () => {
    const TWO_FLOORS = [
      { id: "floor-1", outletId: "outlet-1", name: "Empty Floor", sortOrder: 0, tables: [] },
      {
        id: "floor-2",
        outletId: "outlet-1",
        name: "Terrace",
        sortOrder: 1,
        tables: [{ id: "t2", floorId: "floor-2", label: "T2", x: 40, y: 40, width: 40, height: 40, shape: "square", seatCapacity: 4 }],
      },
    ];

    it("disables delete while the selected floor still has tables", async () => {
      stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");

      const deleteButton = screen.getByTestId("floor-plan-delete-floor-button") as HTMLButtonElement;
      expect(deleteButton.disabled).toBe(true);
      expect(deleteButton.title).toBe("Move or remove its tables first");
    });

    it("confirms and deletes an empty floor, then switches to another floor", async () => {
      const fetchMock = stubFetch({ floors: TWO_FLOORS });
      renderFloorPlan();
      const deleteButton = (await screen.findByTestId("floor-plan-delete-floor-button")) as HTMLButtonElement;
      expect(deleteButton.disabled).toBe(false);

      await userEvent.click(deleteButton);
      await userEvent.type(await screen.findByTestId("confirm-reason"), "Created by mistake");
      await userEvent.click(screen.getByTestId("confirm-submit"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/floors/floor-1"),
          expect.objectContaining({ method: "DELETE" }),
        ),
      );
      expect(screen.queryByTestId("floor-tab-floor-1")).toBeNull();
      expect(await screen.findByTestId("table-shape-t2")).toBeTruthy();
    });

    it("toasts instead of removing the floor when the backend rejects the delete with 409", async () => {
      stubFetch({ floors: TWO_FLOORS, deleteFloorStatus: 409 });
      renderFloorPlan();
      const deleteButton = await screen.findByTestId("floor-plan-delete-floor-button");

      await userEvent.click(deleteButton);
      await userEvent.type(await screen.findByTestId("confirm-reason"), "Created by mistake");
      await userEvent.click(screen.getByTestId("confirm-submit"));

      await screen.findByTestId("toast-error");
      expect(screen.getByTestId("toast-error").textContent).toContain("still has tables");
      expect(screen.getByTestId("floor-tab-floor-1")).toBeTruthy();
    });
  });

  describe("Rename table", () => {
    it("renames a table from the list view", async () => {
      const fetchMock = stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");
      await userEvent.click(screen.getByTestId("floor-plan-view-list"));

      const labelField = await screen.findByTestId("floor-plan-list-label-t1");
      await userEvent.clear(labelField);
      await userEvent.type(labelField, "Patio 1");
      await userEvent.tab();

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/tables/t1"),
          expect.objectContaining({ method: "PATCH", body: JSON.stringify({ label: "Patio 1" }) }),
        ),
      );
      expect(await screen.findByTestId("floor-plan-list-label-t1")).toHaveProperty("value", "Patio 1");
    });
  });

  describe("Delete table", () => {
    it("confirms and deletes a table from the list view", async () => {
      const fetchMock = stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");
      await userEvent.click(screen.getByTestId("floor-plan-view-list"));
      await screen.findByTestId("floor-plan-list-row-t1");

      await userEvent.click(screen.getByTestId("floor-plan-list-delete-t1"));
      await userEvent.type(await screen.findByTestId("confirm-reason"), "No longer needed");
      await userEvent.click(screen.getByTestId("confirm-submit"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/tables/t1"),
          expect.objectContaining({ method: "DELETE" }),
        ),
      );
      expect(await screen.findByTestId("floor-plan-list-empty")).toBeTruthy();
    });
  });

  describe("Edit seats/shape", () => {
    it("PATCHes a shape change and a seat capacity change from the list view", async () => {
      const fetchMock = stubFetch();
      renderFloorPlan();
      await screen.findByTestId("table-shape-t1");
      await userEvent.click(screen.getByTestId("floor-plan-view-list"));

      await userEvent.selectOptions(await screen.findByTestId("floor-plan-list-shape-t1"), "circle");
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/tables/t1"),
          expect.objectContaining({ method: "PATCH", body: JSON.stringify({ shape: "circle" }) }),
        ),
      );

      const capacityField = screen.getByTestId("floor-plan-list-capacity-t1");
      await userEvent.clear(capacityField);
      await userEvent.type(capacityField, "6");
      await userEvent.tab();

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/outlets/outlet-1/floor-plan/tables/t1"),
          expect.objectContaining({ method: "PATCH", body: JSON.stringify({ seatCapacity: 6 }) }),
        ),
      );
    });
  });
});
