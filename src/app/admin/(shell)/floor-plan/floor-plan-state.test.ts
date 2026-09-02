import { describe, expect, it } from "vitest";
import {
  computeDragPosition,
  computeNextTablePosition,
  findOverlap,
  groupTablesByFloor,
  rectsOverlap,
  SHAPE_SIZES,
  snapToGrid,
  stationPrinterIsValid,
  validateAgeingThresholdMinutes,
  validateStationPrinter,
  type DiningTableView,
  type FloorView,
  sizeForSeats,
} from "./floor-plan-state";

describe("snapToGrid", () => {
  it("rounds to the nearest grid line", () => {
    expect(snapToGrid(11)).toBe(8);
    expect(snapToGrid(13)).toBe(16);
    expect(snapToGrid(0)).toBe(0);
  });
});

describe("computeDragPosition", () => {
  const canvas = { width: 400, height: 300 };
  const size = { width: 40, height: 40 };

  it("translates the table by the pointer's movement, snapped to the grid", () => {
    const origin = { pointerX: 100, pointerY: 100, tableX: 40, tableY: 40 };
    const result = computeDragPosition(origin, 121, 137, size, canvas);
    // rawX = 40 + (121-100) = 61 -> snaps to 64; rawY = 40 + (137-100) = 77 -> snaps to 80
    expect(result).toEqual({ x: 64, y: 80 });
  });

  it("clamps to the canvas's left/top edge", () => {
    const origin = { pointerX: 100, pointerY: 100, tableX: 10, tableY: 10 };
    const result = computeDragPosition(origin, 0, 0, size, canvas);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("clamps to the canvas's right/bottom edge, accounting for table size", () => {
    const origin = { pointerX: 0, pointerY: 0, tableX: 0, tableY: 0 };
    const result = computeDragPosition(origin, 10000, 10000, size, canvas);
    expect(result).toEqual({ x: canvas.width - size.width, y: canvas.height - size.height });
  });

  it("is a no-op when the pointer hasn't moved", () => {
    const origin = { pointerX: 50, pointerY: 50, tableX: 88, tableY: 32 };
    expect(computeDragPosition(origin, 50, 50, size, canvas)).toEqual({ x: 88, y: 32 });
  });
});

describe("rectsOverlap / findOverlap", () => {
  const a = { id: "a", x: 0, y: 0, width: 40, height: 40 };

  it("detects overlapping rects", () => {
    expect(rectsOverlap(a, { id: "b", x: 20, y: 20, width: 40, height: 40 })).toBe(true);
  });

  it("does not flag adjacent, non-overlapping rects", () => {
    expect(rectsOverlap(a, { id: "b", x: 40, y: 0, width: 40, height: 40 })).toBe(false);
  });

  it("finds the first overlapping table, ignoring itself", () => {
    const others = [
      { id: "a", x: 0, y: 0, width: 40, height: 40 },
      { id: "b", x: 200, y: 200, width: 40, height: 40 },
      { id: "c", x: 10, y: 10, width: 40, height: 40 },
    ];
    expect(findOverlap(a, others)).toBe("c");
  });

  it("returns null when nothing overlaps", () => {
    const others = [{ id: "b", x: 200, y: 200, width: 40, height: 40 }];
    expect(findOverlap(a, others)).toBeNull();
  });
});

describe("computeNextTablePosition", () => {
  const canvas = { width: 80, height: 80 };
  const size = SHAPE_SIZES.square; // 40x40

  it("places the first table at the origin when the floor is empty", () => {
    expect(computeNextTablePosition([], size, canvas)).toEqual({ x: 0, y: 0 });
  });

  it("scans past an occupied spot to the next clear one on the grid", () => {
    const existing = [{ id: "t1", x: 0, y: 0, width: 40, height: 40 }];
    const result = computeNextTablePosition(existing, size, canvas);
    expect(rectsOverlap({ id: "candidate", ...result, width: size.width, height: size.height }, existing[0])).toBe(false);
  });

  it("falls back to (0, 0) when the floor has no clear spot left", () => {
    const existing = [
      { id: "t1", x: 0, y: 0, width: 40, height: 40 },
      { id: "t2", x: 40, y: 0, width: 40, height: 40 },
      { id: "t3", x: 0, y: 40, width: 40, height: 40 },
      { id: "t4", x: 40, y: 40, width: 40, height: 40 },
    ];
    expect(computeNextTablePosition(existing, size, canvas)).toEqual({ x: 0, y: 0 });
  });
});

describe("validateStationPrinter", () => {
  it("requires a printer or an explicit no-printer acknowledgement", () => {
    const errors = validateStationPrinter({ primaryPrinterId: null, noPrinterAcknowledged: false });
    expect(errors.printer).toBeTruthy();
  });

  it("passes with a printer assigned", () => {
    expect(stationPrinterIsValid({ primaryPrinterId: "printer-1", noPrinterAcknowledged: false })).toBe(true);
  });

  it("passes with no printer, explicitly acknowledged", () => {
    expect(stationPrinterIsValid({ primaryPrinterId: null, noPrinterAcknowledged: true })).toBe(true);
  });

  it("fails with neither a printer nor the acknowledgement, even after one was later unset", () => {
    expect(stationPrinterIsValid({ primaryPrinterId: null, noPrinterAcknowledged: false })).toBe(false);
  });
});

describe("validateAgeingThresholdMinutes", () => {
  it("rejects zero, negative, non-integer and non-finite values", () => {
    expect(validateAgeingThresholdMinutes(0)).toBeTruthy();
    expect(validateAgeingThresholdMinutes(-5)).toBeTruthy();
    expect(validateAgeingThresholdMinutes(2.5)).toBeTruthy();
    expect(validateAgeingThresholdMinutes(Number.NaN)).toBeTruthy();
  });

  it("accepts a positive whole number", () => {
    expect(validateAgeingThresholdMinutes(15)).toBeUndefined();
  });
});

describe("groupTablesByFloor", () => {
  const floors: FloorView[] = [
    { id: "f1", name: "Ground Floor", sortOrder: 0 },
    { id: "f2", name: "Terrace", sortOrder: 1 },
  ];
  const tables: DiningTableView[] = [
    { id: "t1", floorId: "f1", label: "T1", x: 0, y: 0, width: 40, height: 40, shape: "square", seatCapacity: 4 },
    { id: "t2", floorId: "f2", label: "T2", x: 0, y: 0, width: 40, height: 40, shape: "circle", seatCapacity: 2 },
    { id: "t3", floorId: "f1", label: "T3", x: 0, y: 0, width: 40, height: 40, shape: "circle", seatCapacity: 2 },
  ];

  it("groups tables under their floor, preserving floor order", () => {
    const groups = groupTablesByFloor(floors, tables);
    expect(groups.map((g) => g.floor.id)).toEqual(["f1", "f2"]);
    expect(groups[0].tables.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(groups[1].tables.map((t) => t.id)).toEqual(["t2"]);
  });

  it("gives a floor with no tables an empty list, not a missing entry", () => {
    const groups = groupTablesByFloor([...floors, { id: "f3", name: "Basement", sortOrder: 2 }], tables);
    expect(groups[2].tables).toEqual([]);
  });
});

describe("sizeForSeats", () => {
  it("grows with seat capacity and clamps to 56..160, rectangles 1.5x wide", () => {
    expect(sizeForSeats(1, "square")).toEqual({ width: 56, height: 56 });
    expect(sizeForSeats(4, "square")).toEqual({ width: 88, height: 88 });
    expect(sizeForSeats(4, "circle")).toEqual({ width: 88, height: 88 });
    expect(sizeForSeats(4, "rectangle")).toEqual({ width: 132, height: 88 });
    expect(sizeForSeats(40, "square")).toEqual({ width: 160, height: 160 });
  });
});
