import { describe, expect, it } from "vitest";
import {
  deriveTapAction,
  groupTablesByFloor,
  toTableMapEntry,
  type RawTableMapEntry,
  type TableMapEntry,
} from "./table-map-state";

function emptyTable(id: string, floorId = "f1"): TableMapEntry {
  return { id, floorId, label: id.toUpperCase(), seatCapacity: 4, status: "empty", order: null };
}

function occupiedTable(id: string, ownerStaffId: string, floorId = "f1"): TableMapEntry {
  return {
    id,
    floorId,
    label: id.toUpperCase(),
    seatCapacity: 4,
    status: "occupied",
    order: { id: `order-${id}`, ownerStaffId },
  };
}

describe("toTableMapEntry", () => {
  it("maps the real, flat wire shape (RawTableMapEntry) into the display shape", () => {
    const raw: RawTableMapEntry = { tableId: "t1", floorId: "f1", label: "T1", seatCapacity: 4, status: "occupied", orderId: "order-1", ownerId: "staff-me" };
    expect(toTableMapEntry(raw)).toEqual({
      id: "t1",
      floorId: "f1",
      label: "T1",
      seatCapacity: 4,
      status: "occupied",
      order: { id: "order-1", ownerStaffId: "staff-me" },
    });
  });

  it("maps an empty table's null orderId/ownerId to a null order, not a fabricated summary", () => {
    const raw: RawTableMapEntry = { tableId: "t1", floorId: "f1", label: "T1", seatCapacity: 4, status: "empty", orderId: null, ownerId: null };
    expect(toTableMapEntry(raw).order).toBeNull();
  });
});

describe("groupTablesByFloor", () => {
  it("buckets each table under its own floorId, preserving first-appearance order", () => {
    const tables = [emptyTable("t1", "f1"), emptyTable("t2", "f2"), emptyTable("t3", "f1")];
    const groups = groupTablesByFloor(tables);
    expect(groups.map((g) => g.floorId)).toEqual(["f1", "f2"]);
    expect(groups[0].tables.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(groups[1].tables.map((t) => t.id)).toEqual(["t2"]);
  });

  it("never fabricates an empty floor - there is no separate floor list, only floors tables actually reference", () => {
    const groups = groupTablesByFloor([emptyTable("t1", "f1")]);
    expect(groups).toHaveLength(1);
  });
});

describe("deriveTapAction", () => {
  it("starts a new order for an empty table", () => {
    expect(deriveTapAction(emptyTable("t1"), "staff-me")).toEqual({ type: "start_order" });
  });

  it("opens directly when the current staff member already owns the order", () => {
    const table = occupiedTable("t4", "staff-me");
    expect(deriveTapAction(table, "staff-me")).toEqual({ type: "open_order", orderId: "order-t4" });
  });

  it("never silently opens someone else's order - it requires the explicit transfer step, naming the raw owner id (no name-lookup endpoint exists)", () => {
    const table = occupiedTable("t9", "staff-priya");
    expect(deriveTapAction(table, "staff-me")).toEqual({
      type: "transfer_required",
      orderId: "order-t9",
      ownerId: "staff-priya",
    });
  });
});
