import { describe, expect, it } from "vitest";
import type { TicketLineView, TicketView } from "../../api";
import { ageingLevel, formatElapsed, groupLinesByBatch, orderTypeLabel, sortOldestFirst, splitTicketLines, ticketDisplayNumber } from "./station-queue-state";

const FIRED_AT = "2026-08-29T10:00:00.000Z";
const FIRED_MS = Date.parse(FIRED_AT);

function minutesLater(minutes: number): number {
  return FIRED_MS + minutes * 60_000;
}

describe("ageingLevel", () => {
  it("is new right at firedAt", () => {
    expect(ageingLevel(FIRED_AT, 10, FIRED_MS)).toBe("new");
  });

  it("stays new just under the threshold", () => {
    expect(ageingLevel(FIRED_AT, 10, minutesLater(9.9))).toBe("new");
  });

  it("crosses to ageing exactly at the configured threshold", () => {
    expect(ageingLevel(FIRED_AT, 10, minutesLater(10))).toBe("ageing");
  });

  it("stays ageing just under 2x the threshold", () => {
    expect(ageingLevel(FIRED_AT, 10, minutesLater(19.9))).toBe("ageing");
  });

  it("crosses to urgent exactly at 2x the configured threshold", () => {
    expect(ageingLevel(FIRED_AT, 10, minutesLater(20))).toBe("urgent");
  });

  it("stays urgent well past 2x the threshold", () => {
    expect(ageingLevel(FIRED_AT, 10, minutesLater(45))).toBe("urgent");
  });
});

describe("formatElapsed", () => {
  it("counts in seconds, then minutes, then hours (#285)", () => {
    expect(formatElapsed(FIRED_AT, minutesLater(0))).toBe("0s");
    expect(formatElapsed(FIRED_AT, FIRED_MS + 45_000)).toBe("45s");
    expect(formatElapsed(FIRED_AT, FIRED_MS + 65_000)).toBe("1m 05s");
    expect(formatElapsed(FIRED_AT, minutesLater(59) + 59_000)).toBe("59m 59s");
    expect(formatElapsed(FIRED_AT, minutesLater(60))).toBe("1h 00m");
    expect(formatElapsed(FIRED_AT, minutesLater(222))).toBe("3h 42m");
  });

  it("floors at 0s rather than going negative on clock skew", () => {
    expect(formatElapsed(FIRED_AT, FIRED_MS - 5_000)).toBe("0s");
  });
});

function ticket(overrides: Partial<TicketView>): TicketView {
  return {
    id: "t1",
    orderId: "order-1",
    stationId: "s1",
    stationName: "Tandoor",
    tableLabel: "T4",
    tokenNumber: 1035,
    status: "queued",
    firedAt: FIRED_AT,
    bumpedAt: null,
    recallCount: 0,
    recalled: false,
    lines: [],
    ...overrides,
  };
}

describe("sortOldestFirst", () => {
  it("sorts ascending by firedAt without mutating the input", () => {
    const newer = ticket({ id: "newer", firedAt: "2026-08-29T10:05:00.000Z" });
    const older = ticket({ id: "older", firedAt: "2026-08-29T09:55:00.000Z" });
    const input = [newer, older];
    const sorted = sortOldestFirst(input);
    expect(sorted.map((t) => t.id)).toEqual(["older", "newer"]);
    expect(input.map((t) => t.id)).toEqual(["newer", "older"]);
  });
});

describe("orderTypeLabel", () => {
  it("is Dine-in when a table label is present", () => {
    expect(orderTypeLabel({ tableLabel: "T4" })).toBe("Dine-in");
  });
  it("is Counter when there's no table (counter/QSR orders always have tableId null)", () => {
    expect(orderTypeLabel({ tableLabel: null })).toBe("Counter");
  });
});

describe("ticketDisplayNumber", () => {
  it("uses the real token number when present", () => {
    expect(ticketDisplayNumber({ tokenNumber: 1042, tableLabel: null, orderId: "abcdef12-0000" })).toBe("#1042");
  });
  it("names the table for a dine-in order (which never carries a token number)", () => {
    expect(ticketDisplayNumber({ tokenNumber: null, tableLabel: "T1", orderId: "abcdef12-0000" })).toBe("Table T1");
  });
  it("falls back to a short id fragment when there's neither", () => {
    expect(ticketDisplayNumber({ tokenNumber: null, tableLabel: null, orderId: "abcdef12-0000" })).toBe("#abcdef12");
  });
});

function line(overrides: Partial<TicketLineView>): TicketLineView {
  return {
    id: "l1",
    orderLineId: "ol1",
    itemId: "i1",
    itemName: "Butter Chicken",
    variantName: null,
    quantity: 1,
    seatNumber: null,
    modifiers: [],
    addOnBatch: 0,
    voided: false,
    ...overrides,
  };
}

describe("groupLinesByBatch", () => {
  it("groups the original fire (batch 0) separately from later ADD-ON batches, in fire order", () => {
    const lines = [line({ id: "add-on-1", addOnBatch: 1 }), line({ id: "original", addOnBatch: 0 }), line({ id: "add-on-2", addOnBatch: 1 })];
    const groups = groupLinesByBatch(lines);
    expect(groups.map((g) => g.batch)).toEqual([0, 1]);
    expect(groups[0].lines.map((l) => l.id)).toEqual(["original"]);
    expect(groups[1].lines.map((l) => l.id)).toEqual(["add-on-1", "add-on-2"]);
  });

  it("handles a ticket with only its original fire and no add-ons", () => {
    const groups = groupLinesByBatch([line({ id: "only" })]);
    expect(groups).toEqual([{ batch: 0, lines: [expect.objectContaining({ id: "only" })] }]);
  });
});

describe("splitTicketLines (#388)", () => {
  const plain = (count: number) => Array.from({ length: count }, (_, i) => line({ id: `l${i}` }));
  const ids = (pages: TicketLineView[][]) => pages.map((page) => page.map((l) => l.id));

  it("splits 20 plain lines into pages of 12 and 8, in order", () => {
    const pages = splitTicketLines(plain(20));
    expect(pages.map((page) => page.length)).toEqual([12, 8]);
    expect(pages.flat().map((l) => l.id)).toEqual(plain(20).map((l) => l.id));
  });

  it("counts each modifier and a note as a row", () => {
    // 1 + 1 note + 3 modifiers = 5 rows each: two fit in 12, the third does not.
    const heavy = (id: string) => line({ id, note: "no onion", modifiers: [{ id: `${id}m1`, name: "a" }, { id: `${id}m2`, name: "b" }, { id: `${id}m3`, name: "c" }] });
    expect(ids(splitTicketLines([heavy("a"), heavy("b"), heavy("c")]))).toEqual([["a", "b"], ["c"]]);
  });

  it("never splits a line across cards", () => {
    // 11 plain rows + one 3-row line: the 3-row line moves whole to page 2.
    const lines = [...plain(11), line({ id: "big", modifiers: [{ id: "m1", name: "a" }, { id: "m2", name: "b" }] })];
    expect(ids(splitTicketLines(lines))).toEqual([plain(11).map((l) => l.id), ["big"]]);
  });

  it("gives a single oversize line a card of its own", () => {
    const modifiers = Array.from({ length: 15 }, (_, i) => ({ id: `m${i}`, name: `mod ${i}` }));
    const lines = [line({ id: "before" }), line({ id: "huge", modifiers }), line({ id: "after" })];
    expect(ids(splitTicketLines(lines))).toEqual([["before"], ["huge"], ["after"]]);
  });

  it("keeps a short ticket on one page, and an empty ticket as one empty page", () => {
    expect(ids(splitTicketLines(plain(3)))).toEqual([["l0", "l1", "l2"]]);
    expect(splitTicketLines([])).toEqual([[]]);
  });
});
