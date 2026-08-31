import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloorPlanListView } from "./floor-plan-list-view";
import type { DiningTableView, FloorView } from "./floor-plan-state";

const FLOORS: FloorView[] = [
  { id: "f1", name: "Ground Floor", sortOrder: 0 },
  { id: "f2", name: "Terrace", sortOrder: 1 },
];

const TABLES: DiningTableView[] = [
  { id: "t1", floorId: "f1", label: "T1", x: 10, y: 20, width: 40, height: 40, shape: "square", seatCapacity: 4 },
  { id: "t2", floorId: "f2", label: "T2", x: 5, y: 5, width: 40, height: 40, shape: "circle", seatCapacity: 2 },
];

afterEach(() => cleanup());

describe("FloorPlanListView", () => {
  it("renders the same tables the canvas would, grouped by floor", () => {
    render(<FloorPlanListView floors={FLOORS} tables={TABLES} onFieldCommitted={vi.fn()} />);

    expect(screen.getByTestId("floor-plan-list-row-t1").textContent).toContain("Ground Floor");
    expect(screen.getByTestId("floor-plan-list-row-t1").textContent).toContain("T1");
    expect(screen.getByTestId("floor-plan-list-row-t2").textContent).toContain("Terrace");
    expect(screen.getByTestId("floor-plan-list-row-t2").textContent).toContain("T2");

    expect(screen.getByTestId("floor-plan-list-x-t1")).toHaveProperty("value", "10");
    expect(screen.getByTestId("floor-plan-list-y-t1")).toHaveProperty("value", "20");
    expect(screen.getByTestId("floor-plan-list-capacity-t1")).toHaveProperty("value", "4");
  });

  it("shows an empty state when there are no tables", () => {
    render(<FloorPlanListView floors={FLOORS} tables={[]} onFieldCommitted={vi.fn()} />);
    expect(screen.getByTestId("floor-plan-list-empty")).toBeTruthy();
  });

  it("commits an edited x/y/capacity field on blur", async () => {
    const onFieldCommitted = vi.fn();
    render(<FloorPlanListView floors={FLOORS} tables={TABLES} onFieldCommitted={onFieldCommitted} />);

    const capacityField = screen.getByTestId("floor-plan-list-capacity-t1");
    await userEvent.clear(capacityField);
    await userEvent.type(capacityField, "6");
    await userEvent.tab();

    expect(onFieldCommitted).toHaveBeenCalledWith("t1", "seatCapacity", 6);
  });

  it("reverts an invalid edit instead of committing it", async () => {
    const onFieldCommitted = vi.fn();
    render(<FloorPlanListView floors={FLOORS} tables={TABLES} onFieldCommitted={onFieldCommitted} />);

    const capacityField = screen.getByTestId("floor-plan-list-capacity-t1");
    await userEvent.clear(capacityField);
    await userEvent.type(capacityField, "0");
    await userEvent.tab();

    expect(onFieldCommitted).not.toHaveBeenCalled();
    expect(capacityField).toHaveProperty("value", "4");
  });
});
