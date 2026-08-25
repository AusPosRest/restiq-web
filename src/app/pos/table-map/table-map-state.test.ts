import { describe, expect, it } from "vitest";
import {
  deriveTapAction,
  elapsedMinutes,
  formatElapsedLabel,
  groupTablesByFloor,
  type FloorView,
  type TableMapEntry,
} from "./table-map-state";

const FLOORS: FloorView[] = [
  { id: "f1", name: "Ground Floor", sortOrder: 0 },
  { id: "f2", name: "Terrace", sortOrder: 1 },
];

function emptyTable(id: string, floorId = "f1"): TableMapEntry {
  return { id, floorId, label: id.toUpperCase(), seatCapacity: 4, status: "empty", order: null };
}

function occupiedTable(id: string, ownerStaffId: string, ownerStaffName: string, openedAt: string, floorId = "f1"): TableMapEntry {
  return {
    id,
    floorId,
    label: id.toUpperCase(),
    seatCapacity: 4,
    status: "occupied",
    order: { id: `order-${id}`, ownerStaffId, ownerStaffName, openedAt },
  };
}

describe("groupTablesByFloor", () => {
  it("buckets each table under its own floor, preserving floor order", () => {
    const tables = [emptyTable("t1", "f1"), emptyTable("t2", "f2"), emptyTable("t3", "f1")];
    const groups = groupTablesByFloor(FLOORS, tables);
    expect(groups.map((g) => g.floor.id)).toEqual(["f1", "f2"]);
    expect(groups[0].tables.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(groups[1].tables.map((t) => t.id)).toEqual(["t2"]);
  });

  it("leaves a floor with no tables as an empty group rather than dropping it", () => {
    const groups = groupTablesByFloor(FLOORS, [emptyTable("t1", "f1")]);
    expect(groups[1].tables).toEqual([]);
  });
});

describe("deriveTapAction", () => {
  it("starts a new order for an empty table", () => {
    expect(deriveTapAction(emptyTable("t1"), "staff-me")).toEqual({ type: "start_order" });
  });

  it("opens directly when the current staff member already owns the order", () => {
    const table = occupiedTable("t4", "staff-me", "Priya", "2026-08-24T10:00:00.000Z");
    expect(deriveTapAction(table, "staff-me")).toEqual({ type: "open_order", orderId: "order-t4" });
  });

  it("never silently opens someone else's order - it requires the explicit transfer step", () => {
    const table = occupiedTable("t9", "staff-priya", "Priya", "2026-08-24T10:00:00.000Z");
    expect(deriveTapAction(table, "staff-me")).toEqual({
      type: "transfer_required",
      orderId: "order-t9",
      ownerName: "Priya",
    });
  });
});

describe("elapsed time", () => {
  const opened = "2026-08-24T10:00:00.000Z";

  it("computes whole minutes elapsed", () => {
    expect(elapsedMinutes(opened, new Date("2026-08-24T10:22:30.000Z"))).toBe(22);
  });

  it("never goes negative for a clock skew edge case", () => {
    expect(elapsedMinutes(opened, new Date("2026-08-24T09:59:00.000Z"))).toBe(0);
  });

  it("hides the label below the ageing threshold", () => {
    expect(formatElapsedLabel(opened, new Date("2026-08-24T10:05:00.000Z"))).toBeNull();
  });

  it("shows minutes once past the threshold", () => {
    expect(formatElapsedLabel(opened, new Date("2026-08-24T10:22:00.000Z"))).toBe("22m");
  });

  it("shows hours and minutes past an hour", () => {
    expect(formatElapsedLabel(opened, new Date("2026-08-24T11:10:00.000Z"))).toBe("1h 10m");
  });

  it("omits the minutes remainder on an exact hour", () => {
    expect(formatElapsedLabel(opened, new Date("2026-08-24T12:00:00.000Z"))).toBe("2h");
  });
});
